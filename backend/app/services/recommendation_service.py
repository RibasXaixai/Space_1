import json
import os
import random
import time
from typing import Optional

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from app.schemas.phase2 import ClothingAnalysisSchema, WeatherForecastSchema


class RecommendationService:
    """Service for generating outfit recommendations using rule-based filtering and viability checks."""

    TOPS = ["t-shirt", "shirt", "blouse", "sweater", "hoodie", "jacket", "top", "tee", "tank"]
    BOTTOMS = ["jeans", "pants", "shorts", "skirt", "leggings", "trousers", "bottom"]
    OUTERWEAR = ["jacket", "coat", "cardigan", "blazer", "sweater", "hoodie", "parka", "raincoat"]
    SHOES = ["sneakers", "shoes", "boots", "sandals", "heels", "loafers", "shoe"]

    COLD_CONDITIONS = {"snowy", "chilly", "cold", "freezing", "snow", "blizzard", "ice"}
    RAINY_CONDITIONS = {"rainy", "rain", "drizzle", "precipitation", "shower", "storm"}
    COOL_CONDITIONS = {"cloudy", "overcast", "cool", "mild"}
    AI_RETRY_ATTEMPTS = 3
    AI_RETRY_BASE_DELAY_SECONDS = 2

    def __init__(self):
        self.use_ai = False
        self.ai_client = None
        self.ai_model = os.getenv("OPENAI_RECOMMENDATION_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))

        api_key = os.getenv("OPENAI_API_KEY")
        if OpenAI is not None and api_key:
            try:
                self.ai_client = OpenAI(api_key=api_key)
                self.use_ai = True
            except Exception as exc:
                print(f"Warning: Failed to initialize AI recommendation client: {exc}")
                self.use_ai = False

    def generate_recommendations(
        self,
        clothing_data: list[ClothingAnalysisSchema],
        weather_forecast: list[WeatherForecastSchema],
        location: str,
    ) -> dict:
        """Generate 5-day outfit recommendations and wardrobe viability warnings."""
        recommendations: list[dict] = []
        warnings: list[str] = []
        affected_days: list[int] = []

        if not clothing_data:
            warnings.append("No clothing items provided. Using generic recommendations.")
            return self._generate_minimal_recommendations(weather_forecast, warnings)

        if not weather_forecast:
            warnings.append("No weather forecast available. Using default recommendations.")
            return self._generate_minimal_recommendations(weather_forecast, warnings)

        clothing_items = [item.model_dump() for item in clothing_data]
        forecast_days = [day.model_dump() for day in weather_forecast]

        for day_idx, day_forecast in enumerate(forecast_days[:5], start=1):
            outfit = self._build_outfit_for_day(clothing_items, day_forecast, day_idx)
            recommendations.append(outfit)
            if not outfit["is_viable"]:
                affected_days.append(day_idx)

        if affected_days:
            warnings.insert(
                0,
                "Your current wardrobe may not be suitable for the expected weather conditions for some of the next 5 days.",
            )
            warnings.append(
                "Affected days: " + ", ".join([f"Day {day}" for day in affected_days]) + "."
            )

        if len(clothing_items) < 3:
            warnings.append("Limited wardrobe variety. Mix and match existing items for better coverage.")

        return {
            "recommendations": recommendations,
            "warnings": warnings,
            "location": location,
        }

    def refresh_recommendation_for_day(
        self,
        day: int,
        clothing_data: list[ClothingAnalysisSchema],
        weather_forecast: list[WeatherForecastSchema],
    ) -> dict:
        """Regenerate recommendation for a single selected day."""
        if day < 1:
            raise ValueError("day must be >= 1")

        if not clothing_data:
            raise ValueError("No clothing data provided")

        if not weather_forecast or day > len(weather_forecast):
            raise ValueError("Requested day is outside available weather forecast")

        clothing_items = [item.model_dump() for item in clothing_data]
        day_forecast = weather_forecast[day - 1].model_dump()
        return self._build_outfit_for_day(clothing_items, day_forecast, day)

    def _build_outfit_for_day(self, clothing_items: list[dict], day_forecast: dict, day_num: int) -> dict:
        """Build an outfit (AI-first, rule-based fallback) and evaluate viability."""
        ai_outfit = self._build_ai_outfit_for_day(clothing_items, day_forecast, day_num)
        if ai_outfit is not None:
            return ai_outfit

        temp = int(day_forecast.get("temperature", 20))
        condition = str(day_forecast.get("condition", "")).lower()
        humidity = int(day_forecast.get("humidity", 50))

        warmth_need = self._determine_warmth_need(temp, condition)

        top = self._select_clothing_by_role(clothing_items, "top", warmth_need, condition)
        bottom = self._select_clothing_by_role(clothing_items, "bottom", warmth_need, condition)

        needs_outerwear = self._is_cold_or_rainy(temp, condition)
        outerwear = None
        if needs_outerwear:
            outerwear = self._select_clothing_by_role(clothing_items, "outerwear", warmth_need, condition)

        shoes = self._select_clothing_by_role(clothing_items, "shoes", warmth_need, condition)

        outfit_items = []
        if top:
            outfit_items.append(top["category"].title())
        if bottom:
            outfit_items.append(bottom["category"].title())
        if outerwear:
            outfit_items.append(outerwear["category"].title())
        if shoes:
            outfit_items.append(shoes["category"].title())
        if not outfit_items:
            outfit_items = ["No suitable outfit found"]

        is_viable, day_warning = self._evaluate_day_viability(
            temp=temp,
            condition=condition,
            top=top,
            bottom=bottom,
            outerwear=outerwear,
            shoes=shoes,
            selected_items=[item for item in [top, bottom, outerwear, shoes] if item],
        )

        explanation = self._generate_explanation(
            outfit_items=outfit_items,
            temp=temp,
            condition=condition,
            humidity=humidity,
            is_viable=is_viable,
            day_warning=day_warning,
        )

        confidence = self._calculate_confidence(outfit_items, is_viable)

        return {
            "day": day_num,
            "date": day_forecast.get("date"),
            "outfit_description": explanation,
            "clothing_items": outfit_items,
            "weather_match": f"{condition.title()}, {temp}C",
            "confidence": confidence,
            "recommendation_source": "rule-based",
            "is_viable": is_viable,
            "day_warning": day_warning,
        }

    def _build_ai_outfit_for_day(self, clothing_items: list[dict], day_forecast: dict, day_num: int) -> Optional[dict]:
        """Attempt AI recommendation for a single day. Returns None on any failure."""
        if not self.use_ai or self.ai_client is None:
            return None

        try:
            wardrobe_summary = []
            for item in clothing_items:
                wardrobe_summary.append(
                    {
                        "category": item.get("category", ""),
                        "color": item.get("color", ""),
                        "style": item.get("style", ""),
                        "warmth_level": item.get("warmth_level", ""),
                        "weather_suitability": item.get("weather_suitability", ""),
                        "gender": item.get("gender", "Unisex"),
                    }
                )

            prompt = {
                "task": "Generate one outfit recommendation for this day only.",
                "day": day_num,
                "date": day_forecast.get("date"),
                "weather": day_forecast,
                "wardrobe": wardrobe_summary,
                "rules": [
                    "Use only clothing categories that exist in wardrobe.",
                    "Return a safe option for weather conditions.",
                    "If no complete outfit is possible, mark is_viable=false and explain briefly.",
                    "Provide a fresh alternative option when possible.",
                ],
                "output_json_schema": {
                    "outfit_description": "string",
                    "clothing_items": ["string"],
                    "weather_match": "string",
                    "confidence": "number between 0 and 1",
                    "is_viable": "boolean",
                    "day_warning": "string or null",
                },
            }

            response = None
            for attempt in range(self.AI_RETRY_ATTEMPTS):
                try:
                    response = self.ai_client.chat.completions.create(
                        model=self.ai_model,
                        temperature=0.7,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a fashion recommendation assistant. Return only valid JSON.",
                            },
                            {
                                "role": "user",
                                "content": json.dumps(prompt),
                            },
                        ],
                    )
                    break
                except Exception as exc:
                    if self._is_rate_limit_error(exc) and attempt < self.AI_RETRY_ATTEMPTS - 1:
                        delay = self.AI_RETRY_BASE_DELAY_SECONDS * (attempt + 1)
                        print(
                            f"AI recommendation rate-limited (day {day_num}), retrying in {delay}s..."
                        )
                        time.sleep(delay)
                        continue
                    raise

            if response is None:
                return None

            raw = (response.choices[0].message.content or "").strip()
            if raw.startswith("```"):
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:].strip()

            if "{" in raw and "}" in raw:
                raw = raw[raw.find("{") : raw.rfind("}") + 1]

            parsed = json.loads(raw)

            outfit_description = str(parsed.get("outfit_description", "")).strip()
            clothing_items_out = parsed.get("clothing_items", [])
            if not isinstance(clothing_items_out, list):
                clothing_items_out = []
            clothing_items_out = [str(item).strip() for item in clothing_items_out if str(item).strip()]
            if not clothing_items_out:
                clothing_items_out = ["No suitable outfit found"]

            weather_match = str(parsed.get("weather_match", "")).strip()
            if not weather_match:
                condition = str(day_forecast.get("condition", "")).title()
                temp = int(day_forecast.get("temperature", 20))
                weather_match = f"{condition}, {temp}C"

            confidence_raw = parsed.get("confidence", 0.7)
            try:
                confidence = float(confidence_raw)
            except (TypeError, ValueError):
                confidence = 0.7
            confidence = min(1.0, max(0.35, confidence))

            is_viable = bool(parsed.get("is_viable", True))
            day_warning_raw = parsed.get("day_warning")
            day_warning = str(day_warning_raw).strip() if day_warning_raw else None

            if not outfit_description:
                outfit_description = "AI generated this recommendation based on your wardrobe and weather."

            return {
                "day": day_num,
                "date": day_forecast.get("date"),
                "outfit_description": outfit_description,
                "clothing_items": clothing_items_out,
                "weather_match": weather_match,
                "confidence": confidence,
                "recommendation_source": "ai",
                "is_viable": is_viable,
                "day_warning": day_warning,
            }
        except Exception as exc:
            print(f"AI recommendation error (day {day_num}): {exc}")
            return None

    def _is_rate_limit_error(self, exc: Exception) -> bool:
        error_text = str(exc).lower()
        return (
            "429" in error_text
            or "rate limit" in error_text
            or "rate_limit" in error_text
            or "tokens per min" in error_text
        )

    def _evaluate_day_viability(
        self,
        temp: int,
        condition: str,
        top: Optional[dict],
        bottom: Optional[dict],
        outerwear: Optional[dict],
        shoes: Optional[dict],
        selected_items: list[dict],
    ) -> tuple[bool, Optional[str]]:
        """Evaluate whether wardrobe can support a safe and suitable outfit for the day."""
        if not top or not bottom:
            return False, "No complete outfit available (missing top or bottom) for this day."

        if self._is_very_cold_or_snow(temp, condition):
            has_warm_layer = any(
                str(item.get("warmth_level", "")).lower() in {"warm", "moderate"}
                for item in selected_items
            )
            has_boots = shoes is not None and "boot" in str(shoes.get("category", "")).lower()
            if not outerwear or not has_warm_layer or not has_boots:
                return False, "Very cold or snowy day needs coat/warm layers/boots, but wardrobe is missing one or more."

        if self._is_rainy(condition):
            rain_outerwear = outerwear is not None and "rain" in str(outerwear.get("weather_suitability", "")).lower()
            rain_shoes = shoes is not None and (
                "rain" in str(shoes.get("weather_suitability", "")).lower()
                or "boot" in str(shoes.get("category", "")).lower()
            )
            if not rain_outerwear or not rain_shoes:
                return False, "Rain expected but no suitable rain outerwear or shoes were found."

        if temp >= 30 and selected_items:
            all_heavy = all(
                str(item.get("warmth_level", "")).lower() == "warm"
                for item in selected_items
            )
            if all_heavy:
                return False, "Hot weather expected, but available outfit pieces are all heavy/warm items."

        return True, None

    def _determine_warmth_need(self, temperature: int, condition: str) -> str:
        if self._is_very_cold_or_snow(temperature, condition):
            return "warm"
        if temperature < 16 or any(token in condition for token in self.COOL_CONDITIONS):
            return "moderate"
        return "light"

    def _select_clothing_by_role(
        self, clothing_items: list[dict], role: str, warmth_need: str, condition: str
    ) -> Optional[dict]:
        candidates = []

        for item in clothing_items:
            category = self._categorize_clothing(item)
            if category != role:
                continue

            item_warmth = str(item.get("warmth_level", "moderate")).lower()
            if warmth_need == "warm" and item_warmth not in {"warm", "moderate"}:
                continue
            if warmth_need == "light" and item_warmth == "warm":
                continue

            suitability = str(item.get("weather_suitability", "any")).lower()
            if self._is_rainy(condition) and "rain" not in suitability and "any" not in suitability:
                continue

            candidates.append(item)

        return random.choice(candidates) if candidates else None

    def _categorize_clothing(self, clothing_item: dict) -> str:
        category = str(clothing_item.get("category", "")).lower()

        if category in self.TOPS or any(keyword in category for keyword in ["shirt", "top", "blouse"]):
            return "top"
        if category in self.BOTTOMS or any(keyword in category for keyword in ["pant", "short", "skirt", "leg"]):
            return "bottom"
        if category in self.OUTERWEAR or any(keyword in category for keyword in ["jacket", "coat", "cardigan", "hoodie"]):
            return "outerwear"
        if category in self.SHOES or any(keyword in category for keyword in ["shoe", "boot", "sandal", "sneaker"]):
            return "shoes"

        return "top"

    def _generate_explanation(
        self,
        outfit_items: list[str],
        temp: int,
        condition: str,
        humidity: int,
        is_viable: bool,
        day_warning: Optional[str],
    ) -> str:
        if not is_viable and day_warning:
            return f"No fully viable outfit for this day. {day_warning}"

        if not outfit_items or outfit_items == ["No suitable outfit found"]:
            base = "A basic outfit was suggested from limited options."
        else:
            base = "Outfit selected: " + ", ".join(outfit_items) + "."

        if temp < 10:
            weather_context = f" It will be cold ({temp}C), so warm layering is important."
        elif temp < 25:
            weather_context = f" Weather is mild ({temp}C), so this should stay comfortable."
        else:
            weather_context = f" It will be hot ({temp}C), so lighter clothing is preferred."

        if self._is_rainy(condition):
            weather_context += " Rain is expected, so weather-resistant pieces matter."

        if humidity > 70:
            weather_context += " Humidity is high, so breathable fabrics can help."

        return base + weather_context

    def _calculate_confidence(self, outfit_items: list[str], is_viable: bool) -> float:
        if not is_viable:
            return 0.35

        score = 0.5
        if len(outfit_items) >= 3:
            score += 0.3
        elif len(outfit_items) == 2:
            score += 0.15

        if outfit_items and outfit_items != ["No suitable outfit found"]:
            score += 0.1

        score += random.uniform(-0.05, 0.05)
        return min(1.0, max(0.4, score))

    def _is_very_cold_or_snow(self, temp: int, condition: str) -> bool:
        return temp <= 2 or any(token in condition for token in self.COLD_CONDITIONS)

    def _is_rainy(self, condition: str) -> bool:
        return any(token in condition for token in self.RAINY_CONDITIONS)

    def _is_cold_or_rainy(self, temp: int, condition: str) -> bool:
        return temp <= 12 or self._is_rainy(condition) or self._is_very_cold_or_snow(temp, condition)

    def _generate_minimal_recommendations(
        self, weather_forecast: list[WeatherForecastSchema], warnings: list[str]
    ) -> dict:
        recommendations = []

        for idx, day in enumerate(weather_forecast[:5], start=1):
            recommendations.append(
                {
                    "day": idx,
                    "date": day.date,
                    "outfit_description": (
                        "No viable outfit could be generated because wardrobe data is missing. "
                        f"Forecast: {day.condition.lower()}, {day.temperature}C."
                    ),
                    "clothing_items": ["No suitable outfit found"],
                    "weather_match": f"{day.condition}, {day.temperature}C",
                    "confidence": 0.35,
                    "recommendation_source": "rule-based",
                    "is_viable": False,
                    "day_warning": "No wardrobe data available for viability checks.",
                }
            )

        return {
            "recommendations": recommendations,
            "warnings": warnings,
            "location": "Unknown",
        }
