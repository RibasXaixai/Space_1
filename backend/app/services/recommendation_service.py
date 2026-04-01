import random
from typing import Optional

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

    def _build_outfit_for_day(self, clothing_items: list[dict], day_forecast: dict, day_num: int) -> dict:
        """Build an outfit and evaluate if it is viable for the day weather."""
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
            "is_viable": is_viable,
            "day_warning": day_warning,
        }

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
                    "is_viable": False,
                    "day_warning": "No wardrobe data available for viability checks.",
                }
            )

        return {
            "recommendations": recommendations,
            "warnings": warnings,
            "location": "Unknown",
        }
