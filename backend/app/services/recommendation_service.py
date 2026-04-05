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

    TOPS = ["t-shirt", "shirt", "blouse", "sweater", "hoodie", "top", "tee", "tank", "polo"]
    BOTTOMS = ["jeans", "pants", "shorts", "skirt", "leggings", "trousers", "bottom"]
    DRESSES = ["dress", "jumpsuit", "romper", "overall"]
    OUTERWEAR = ["jacket", "coat", "cardigan", "blazer", "sweater", "hoodie", "parka", "raincoat"]
    SHOES = ["sneakers", "shoes", "boots", "sandals", "heels", "loafers", "shoe"]
    ACCESSORIES = ["hat", "cap", "beanie", "scarf", "glove", "gloves", "belt", "bag", "watch", "tie", "sunglasses", "sock", "socks"]

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

        clothing_items = [
            item.model_dump() for item in clothing_data if getattr(item, "status", "analyzed") == "analyzed"
        ]
        forecast_days = [day.model_dump() for day in weather_forecast]
        history: list[dict] = []

        if not clothing_items:
            warnings.append("No reviewed clothing items are available for recommendations yet.")
            return self._generate_minimal_recommendations(weather_forecast, warnings)

        warnings.extend(self._build_variety_warnings(clothing_items, forecast_days))
        warnings.extend(self._build_weather_gap_warnings(clothing_items, forecast_days))

        for day_idx, day_forecast in enumerate(forecast_days[:5], start=1):
            outfit = self._build_outfit_for_day(clothing_items, day_forecast, day_idx, history)
            recommendations.append(outfit)
            history.append(outfit)
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

    def refresh_recommendations_for_week(
        self,
        clothing_data: list[ClothingAnalysisSchema],
        weather_forecast: list[WeatherForecastSchema],
        location: str,
        current_recommendations: Optional[list] = None,
    ) -> dict:
        """Regenerate the full week, avoiding the currently visible outfits when alternatives exist."""
        recommendations: list[dict] = []
        warnings: list[str] = []
        affected_days: list[int] = []

        if not clothing_data:
            raise ValueError("No clothing data provided")
        if not weather_forecast:
            raise ValueError("No weather forecast available")

        clothing_items = [
            item.model_dump() for item in clothing_data if getattr(item, "status", "analyzed") == "analyzed"
        ]
        if not clothing_items:
            raise ValueError("No reviewed clothing items are available for this refresh")

        forecast_days = [day.model_dump() for day in weather_forecast]
        history: list[dict] = []
        previous_days = [
            recommendation.model_dump() if hasattr(recommendation, "model_dump") else recommendation
            for recommendation in (current_recommendations or [])
        ]

        warnings.extend(self._build_variety_warnings(clothing_items, forecast_days))
        warnings.extend(self._build_weather_gap_warnings(clothing_items, forecast_days))

        for day_idx, day_forecast in enumerate(forecast_days[:5], start=1):
            avoid_outfit = previous_days[day_idx - 1] if day_idx - 1 < len(previous_days) else None
            outfit = self._build_outfit_for_day(
                clothing_items,
                day_forecast,
                day_idx,
                history,
                avoid_outfit=avoid_outfit,
            )
            recommendations.append(outfit)
            history.append(outfit)
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

        clothing_items = [
            item.model_dump() for item in clothing_data if getattr(item, "status", "analyzed") == "analyzed"
        ]
        if not clothing_items:
            raise ValueError("No reviewed clothing items are available for this refresh")

        history: list[dict] = []

        for previous_day in range(1, day):
            previous_forecast = weather_forecast[previous_day - 1].model_dump()
            prior_outfit = self._build_outfit_for_day(clothing_items, previous_forecast, previous_day, history)
            history.append(prior_outfit)

        day_forecast = weather_forecast[day - 1].model_dump()
        return self._build_outfit_for_day(clothing_items, day_forecast, day, history)

    def _build_outfit_for_day(
        self,
        clothing_items: list[dict],
        day_forecast: dict,
        day_num: int,
        history: Optional[list[dict]] = None,
        avoid_outfit: Optional[dict] = None,
    ) -> dict:
        """Build an outfit (AI-first, rule-based fallback) and evaluate viability."""
        history = history or []
        temp = int(day_forecast.get("temperature", 20))
        condition = str(day_forecast.get("condition", "")).lower()
        humidity = int(day_forecast.get("humidity", 50))
        warmth_need = self._determine_warmth_need(temp, condition)

        ai_outfit = self._build_ai_outfit_for_day(clothing_items, day_forecast, day_num, history)
        if ai_outfit is not None:
            ai_outfit = self._complete_ai_outfit_with_weather_support(
                ai_outfit=ai_outfit,
                clothing_items=clothing_items,
                temp=temp,
                condition=condition,
                warmth_need=warmth_need,
            )
            ai_role_items = self._select_primary_items_by_role(
                self._match_labels_to_wardrobe_items(ai_outfit.get("clothing_items", []), clothing_items)
            )
            ai_selected_items = [item for item in ai_role_items.values() if item]
            ai_is_viable, ai_day_warning = self._evaluate_day_viability(
                temp=temp,
                condition=condition,
                top=ai_role_items.get("top"),
                bottom=ai_role_items.get("bottom"),
                dress=ai_role_items.get("dress"),
                outerwear=ai_role_items.get("outerwear"),
                shoes=ai_role_items.get("shoes"),
                selected_items=ai_selected_items,
            )
            ai_outfit["is_viable"] = ai_is_viable
            ai_outfit["day_warning"] = ai_day_warning

            ai_has_rotation_conflict = self._violates_rotation_rules(
                ai_outfit.get("clothing_items", []),
                history,
                ai_outfit.get("selected_role_ids"),
            )
            ai_matches_avoid = self._matches_avoid_outfit(ai_outfit, avoid_outfit)
            ai_repeat_is_unavoidable = self._allow_ai_repeat_when_wardrobe_is_limited(
                clothing_items=clothing_items,
                outfit_items=ai_outfit.get("clothing_items", []),
                history=history,
                selected_role_ids=ai_outfit.get("selected_role_ids"),
                avoid_outfit=avoid_outfit,
            )

            if ai_is_viable and (not ai_has_rotation_conflict or ai_repeat_is_unavoidable) and (
                not ai_matches_avoid or ai_repeat_is_unavoidable
            ):
                return ai_outfit

        top_candidates = self._get_candidates_for_role(clothing_items, "top", warmth_need)
        bottom_candidates = self._get_candidates_for_role(clothing_items, "bottom", warmth_need)
        dress_candidates = self._get_candidates_for_role(clothing_items, "dress", warmth_need)
        outerwear_candidates = self._get_candidates_for_role(clothing_items, "outerwear", warmth_need)
        shoe_candidates = self._get_candidates_for_role(clothing_items, "shoes", warmth_need)

        best_option: Optional[dict] = None
        needs_outerwear = self._is_cold_or_rainy(temp, condition)
        outerwear_options = outerwear_candidates if needs_outerwear and outerwear_candidates else [None]
        if not needs_outerwear:
            outerwear_options = [None] + outerwear_candidates[:2]
        shoe_options = shoe_candidates if shoe_candidates else [None]

        dress_options = dress_candidates if dress_candidates else [None]
        for dress in dress_options:
            current_top_options = [None] if dress else (top_candidates or [None])
            current_bottom_options = [None] if dress else (bottom_candidates or [None])

            for top in current_top_options:
                for bottom in current_bottom_options:
                    for outerwear in outerwear_options:
                        for shoes in shoe_options:
                            selected_items = [item for item in [dress, top, bottom, outerwear, shoes] if item]
                            outfit_items = [str(item.get("category", "")).title() for item in selected_items if item.get("category")]
                            if not outfit_items:
                                outfit_items = ["No suitable outfit found"]

                            is_viable, day_warning = self._evaluate_day_viability(
                                temp=temp,
                                condition=condition,
                                top=top,
                                bottom=bottom,
                                dress=dress,
                                outerwear=outerwear,
                                shoes=shoes,
                                selected_items=selected_items,
                            )

                            score = self._score_outfit(
                                selected_items=selected_items,
                                outfit_items=outfit_items,
                                warmth_need=warmth_need,
                                temp=temp,
                                condition=condition,
                                is_viable=is_viable,
                                history=history,
                                avoid_outfit=avoid_outfit,
                            )

                            candidate = {
                                "dress": dress,
                                "top": top,
                                "bottom": bottom,
                                "outerwear": outerwear,
                                "shoes": shoes,
                                "selected_items": selected_items,
                                "outfit_items": outfit_items,
                                "is_viable": is_viable,
                                "day_warning": day_warning,
                                "score": score,
                            }

                            if best_option is None or candidate["score"] > best_option["score"]:
                                best_option = candidate

        if best_option is None:
            best_option = {
                "selected_items": [],
                "outfit_items": ["No suitable outfit found"],
                "is_viable": False,
                "day_warning": "No suitable outfit could be assembled from the current wardrobe.",
            }

        explanation = self._generate_explanation(
            outfit_items=best_option["outfit_items"],
            temp=temp,
            condition=condition,
            humidity=humidity,
            is_viable=best_option["is_viable"],
            day_warning=best_option["day_warning"],
        )

        confidence = self._calculate_confidence(best_option["outfit_items"], best_option["is_viable"])

        selected_item_ids = [
            str(item.get("item_id"))
            for item in best_option.get("selected_items", [])
            if item.get("item_id")
        ]
        selected_role_ids = self._get_selected_role_ids(best_option.get("selected_items", []))

        return {
            "day": day_num,
            "date": day_forecast.get("date"),
            "outfit_description": explanation,
            "clothing_items": best_option["outfit_items"],
            "selected_item_ids": selected_item_ids,
            "selected_role_ids": selected_role_ids,
            "weather_match": f"{condition.title()}, {temp}C",
            "confidence": confidence,
            "recommendation_source": "rule-based",
            "is_viable": best_option["is_viable"],
            "day_warning": best_option["day_warning"],
        }

    def _build_variety_warnings(self, clothing_items: list[dict], forecast_days: list[dict]) -> list[str]:
        warnings: list[str] = []
        top_names = self._get_distinct_categories_for_role(clothing_items, "top")
        bottom_names = self._get_distinct_categories_for_role(clothing_items, "bottom")
        top_count = len(top_names)
        bottom_count = len(bottom_names)
        plan_days = min(5, len(forecast_days))

        if top_count < 2:
            warnings.append("Limited top variety may cause repeated tops across the 5-day plan. Add at least one more top for better rotation.")
        if bottom_count < 2:
            warnings.append("Limited bottom variety may cause repeated bottoms across the 5-day plan. Add at least one more bottom for better rotation.")
        if top_count + bottom_count < 4:
            warnings.append("Wardrobe variety is limited, so some repetition may still be necessary.")

        if top_count < plan_days:
            top_summary = self._summarize_categories(top_names)
            warnings.append(
                f"Top rotation is limited: you currently have {top_count} option(s) for {plan_days} forecast day(s) ({top_summary}), so repeats may still be needed."
            )
        if bottom_count < plan_days:
            bottom_summary = self._summarize_categories(bottom_names)
            warnings.append(
                f"Bottom rotation is limited: you currently have {bottom_count} option(s) for {plan_days} forecast day(s) ({bottom_summary}), so repeats may still be needed."
            )

        return warnings

    def _get_distinct_categories_for_role(self, clothing_items: list[dict], role: str) -> list[str]:
        categories: list[str] = []
        seen: set[str] = set()

        for item in clothing_items:
            if self._categorize_clothing(item) != role:
                continue
            category = str(item.get("category", "")).strip()
            if not category:
                continue
            key = category.lower()
            if key in seen:
                continue
            categories.append(category)
            seen.add(key)

        return categories

    def _summarize_categories(self, categories: list[str], max_items: int = 3) -> str:
        if not categories:
            return "no matching items"

        visible = categories[:max_items]
        if len(visible) == 1:
            summary = visible[0]
        elif len(visible) == 2:
            summary = f"{visible[0]} and {visible[1]}"
        else:
            summary = ", ".join(visible[:-1]) + f", and {visible[-1]}"

        remaining = len(categories) - len(visible)
        if remaining > 0:
            summary += f" (+{remaining} more)"

        return summary

    def _build_weather_gap_warnings(self, clothing_items: list[dict], forecast_days: list[dict]) -> list[str]:
        warnings: list[str] = []
        rainy_days = [day.get("day") for day in forecast_days if self._is_rainy(str(day.get("condition", "")).lower())]
        cold_days = [day.get("day") for day in forecast_days if self._is_very_cold_or_snow(int(day.get("temperature", 20)), str(day.get("condition", "")).lower())]
        hot_days = [day.get("day") for day in forecast_days if int(day.get("temperature", 20)) >= 28]

        has_warm_outerwear = any(
            self._categorize_clothing(item) == "outerwear"
            and self._normalize_warmth_level(item.get("warmth_level", "medium")) in {"warm", "moderate"}
            for item in clothing_items
        )
        has_boots = any("boot" in str(item.get("category", "")).lower() for item in clothing_items)
        has_rain_outerwear = any(
            self._categorize_clothing(item) == "outerwear"
            and self._weather_suitability_matches(
                str(item.get("weather_suitability", "")),
                "rain",
                12,
            )
            for item in clothing_items
        )
        has_weather_ready_shoes = any(
            self._categorize_clothing(item) == "shoes"
            and (
                self._weather_suitability_matches(str(item.get("weather_suitability", "")), "rain", 12)
                or any(token in str(item.get("category", "")).lower() for token in ["boot", "shoe", "sneaker"])
            )
            for item in clothing_items
        )
        has_light_options = any(
            self._categorize_clothing(item) == "top"
            and self._normalize_warmth_level(item.get("warmth_level", "medium")) == "light"
            for item in clothing_items
        )

        if rainy_days and (not has_rain_outerwear or not has_weather_ready_shoes):
            missing_items: list[str] = []
            if not has_rain_outerwear:
                missing_items.append("a rain jacket or coat")
            if not has_weather_ready_shoes:
                missing_items.append("weather-ready shoes or boots")
            warnings.append(
                f"Rain is expected on {self._format_day_list(rainy_days)}. Consider adding {self._join_with_and(missing_items)}."
            )

        if cold_days and (not has_warm_outerwear or not has_boots):
            missing_items = []
            if not has_warm_outerwear:
                missing_items.append("a warmer coat or jacket")
            if not has_boots:
                missing_items.append("boots for colder days")
            warnings.append(
                f"Cold-weather coverage is limited for {self._format_day_list(cold_days)}. Consider adding {self._join_with_and(missing_items)}."
            )

        if hot_days and not has_light_options:
            warnings.append(
                f"Warm-weather coverage is limited for {self._format_day_list(hot_days)}. Consider adding lighter tops or breathable outfits."
            )

        return warnings

    def _format_day_list(self, days: list[Optional[int]]) -> str:
        valid_days = [f"Day {day}" for day in days if day is not None]
        if not valid_days:
            return "the coming days"
        if len(valid_days) == 1:
            return valid_days[0]
        if len(valid_days) == 2:
            return f"{valid_days[0]} and {valid_days[1]}"
        return ", ".join(valid_days[:-1]) + f", and {valid_days[-1]}"

    def _join_with_and(self, parts: list[str]) -> str:
        if not parts:
            return "additional wardrobe coverage"
        if len(parts) == 1:
            return parts[0]
        return ", ".join(parts[:-1]) + f" and {parts[-1]}"

    def _get_candidates_for_role(self, clothing_items: list[dict], role: str, warmth_need: str) -> list[dict]:
        candidates: list[dict] = []

        for item in clothing_items:
            if self._categorize_clothing(item) != role:
                continue

            item_warmth = self._normalize_warmth_level(item.get("warmth_level", "medium"))
            if warmth_need == "warm" and item_warmth == "light":
                continue
            if warmth_need == "light" and item_warmth == "warm":
                continue

            candidates.append(item)

        random.shuffle(candidates)
        return candidates

    def _complete_ai_outfit_with_weather_support(
        self,
        ai_outfit: dict,
        clothing_items: list[dict],
        temp: int,
        condition: str,
        warmth_need: str,
    ) -> dict:
        matched_items = self._match_labels_to_wardrobe_items(ai_outfit.get("clothing_items", []), clothing_items)
        role_items = self._select_primary_items_by_role(matched_items)

        if role_items.get("dress") is None:
            if role_items.get("top") is None:
                role_items["top"] = self._choose_best_candidate_for_role(clothing_items, "top", warmth_need, condition, temp)
            if role_items.get("bottom") is None:
                role_items["bottom"] = self._choose_best_candidate_for_role(clothing_items, "bottom", warmth_need, condition, temp)

        if self._is_cold_or_rainy(temp, condition) and role_items.get("outerwear") is None:
            role_items["outerwear"] = self._choose_best_candidate_for_role(clothing_items, "outerwear", warmth_need, condition, temp)

        current_shoes = role_items.get("shoes")
        current_shoes_are_weather_ready = current_shoes is not None and (
            self._weather_suitability_matches(str(current_shoes.get("weather_suitability", "")), condition, temp)
            or any(token in str(current_shoes.get("category", "")).lower() for token in ["boot", "shoe", "sneaker"])
        )
        if current_shoes is None or (self._is_rainy(condition) and not current_shoes_are_weather_ready):
            better_shoes = self._choose_best_candidate_for_role(clothing_items, "shoes", warmth_need, condition, temp)
            if better_shoes is not None:
                role_items["shoes"] = better_shoes

        ordered_items = self._ordered_selected_items_from_roles(role_items)
        if ordered_items:
            ai_outfit["clothing_items"] = [str(item.get("category", "")).title() for item in ordered_items if item.get("category")]
            ai_outfit["selected_item_ids"] = [
                str(item.get("item_id"))
                for item in ordered_items
                if item.get("item_id")
            ]
            ai_outfit["selected_role_ids"] = self._get_selected_role_ids(ordered_items)

        return ai_outfit

    def _choose_best_candidate_for_role(
        self,
        clothing_items: list[dict],
        role: str,
        warmth_need: str,
        condition: str,
        temp: int,
    ) -> Optional[dict]:
        candidates = self._get_candidates_for_role(clothing_items, role, warmth_need)
        if not candidates:
            return None

        def candidate_score(item: dict) -> tuple[int, int]:
            score = 0
            category = str(item.get("category", "")).lower()
            suitability = str(item.get("weather_suitability", ""))
            warmth = self._normalize_warmth_level(item.get("warmth_level", "medium"))

            if self._weather_suitability_matches(suitability, condition, temp):
                score += 5
            if warmth == warmth_need:
                score += 3
            elif warmth_need == "warm" and warmth == "moderate":
                score += 2
            elif warmth_need == "light" and warmth == "moderate":
                score += 1

            if role == "outerwear":
                if self._is_rainy(condition) and any(token in category for token in ["rain", "jacket", "coat", "parka"]):
                    score += 4
                elif temp <= 12 and any(token in category for token in ["coat", "jacket", "parka", "hoodie"]):
                    score += 2

            if role == "shoes":
                if self._is_rainy(condition) and "boot" in category:
                    score += 5
                elif self._is_rainy(condition) and any(token in category for token in ["shoe", "sneaker"]):
                    score += 2

            return score, len(category)

        return max(candidates, key=candidate_score)

    def _ordered_selected_items_from_roles(self, role_items: dict[str, Optional[dict]]) -> list[dict]:
        ordered: list[dict] = []
        dress = role_items.get("dress")
        if dress is not None:
            ordered.append(dress)
        else:
            if role_items.get("top") is not None:
                ordered.append(role_items["top"])
            if role_items.get("bottom") is not None:
                ordered.append(role_items["bottom"])

        if role_items.get("outerwear") is not None:
            ordered.append(role_items["outerwear"])
        if role_items.get("shoes") is not None:
            ordered.append(role_items["shoes"])

        seen_ids: set[str] = set()
        unique_items: list[dict] = []
        for item in ordered:
            item_id = str(item.get("item_id", "")) if item else ""
            if item_id and item_id in seen_ids:
                continue
            if item_id:
                seen_ids.add(item_id)
            unique_items.append(item)

        return unique_items

    def _score_outfit(
        self,
        selected_items: list[dict],
        outfit_items: list[str],
        warmth_need: str,
        temp: int,
        condition: str,
        is_viable: bool,
        history: list[dict],
        avoid_outfit: Optional[dict] = None,
    ) -> float:
        score = 100.0 if is_viable else 35.0

        if selected_items:
            score += min(12, len(selected_items) * 3)

        for item in selected_items:
            item_warmth = self._normalize_warmth_level(item.get("warmth_level", "medium"))
            suitability = str(item.get("weather_suitability", "")).lower()

            if item_warmth == warmth_need:
                score += 6
            elif warmth_need == "warm" and item_warmth == "moderate":
                score += 4
            elif warmth_need == "light" and item_warmth == "moderate":
                score += 3
            else:
                score -= 2

            if self._weather_suitability_matches(suitability, condition, temp):
                score += 4

        score -= self._rotation_penalty(
            outfit_items,
            history,
            self._get_selected_role_ids(selected_items),
            avoid_outfit=avoid_outfit,
        )
        return score + random.uniform(0.0, 0.25)

    def _rotation_penalty(
        self,
        outfit_items: list[str],
        history: list[dict],
        selected_role_ids: Optional[dict[str, Optional[str]]] = None,
        avoid_outfit: Optional[dict] = None,
    ) -> float:
        if not history:
            return 0.0

        penalty = 0.0
        current_signature = self._build_outfit_signature(outfit_items)
        previous_signature = self._build_outfit_signature(history[-1].get("clothing_items", []))
        if current_signature == previous_signature:
            penalty += 90.0

        current_top = self._extract_role_label(outfit_items, "top")
        current_bottom = self._extract_role_label(outfit_items, "bottom")
        recent_tops = [self._extract_role_label(day.get("clothing_items", []), "top") for day in history[-2:]]
        recent_bottoms = [self._extract_role_label(day.get("clothing_items", []), "bottom") for day in history[-2:]]

        if current_top and recent_tops and recent_tops[-1] == current_top:
            penalty += 28.0
        if current_bottom and recent_bottoms and recent_bottoms[-1] == current_bottom:
            penalty += 28.0

        previous_role_ids = history[-1].get("selected_role_ids", {}) if history else {}
        current_top_id = (selected_role_ids or {}).get("top") if selected_role_ids else None
        current_bottom_id = (selected_role_ids or {}).get("bottom") if selected_role_ids else None
        if current_top_id and previous_role_ids.get("top") == current_top_id:
            penalty += 24.0
        if current_bottom_id and previous_role_ids.get("bottom") == current_bottom_id:
            penalty += 24.0

        if current_top and len(recent_tops) >= 2 and recent_tops[-1] == current_top and recent_tops[-2] == current_top:
            penalty += 120.0
        if current_bottom and len(recent_bottoms) >= 2 and recent_bottoms[-1] == current_bottom and recent_bottoms[-2] == current_bottom:
            penalty += 120.0

        if avoid_outfit:
            avoid_signature = self._build_outfit_signature(avoid_outfit.get("clothing_items", []))
            if current_signature == avoid_signature:
                penalty += 140.0

            avoid_role_ids = avoid_outfit.get("selected_role_ids", {})
            if current_top_id and avoid_role_ids.get("top") == current_top_id:
                penalty += 36.0
            if current_bottom_id and avoid_role_ids.get("bottom") == current_bottom_id:
                penalty += 36.0

        return penalty

    def _violates_rotation_rules(
        self,
        outfit_items: list[str],
        history: list[dict],
        selected_role_ids: Optional[dict[str, Optional[str]]] = None,
    ) -> bool:
        if not history:
            return False

        current_signature = self._build_outfit_signature(outfit_items)
        previous_signature = self._build_outfit_signature(history[-1].get("clothing_items", []))
        if current_signature == previous_signature:
            return True

        previous_role_ids = history[-1].get("selected_role_ids", {}) if history else {}
        if selected_role_ids:
            if selected_role_ids.get("top") and previous_role_ids.get("top") == selected_role_ids.get("top"):
                return True
            if selected_role_ids.get("bottom") and previous_role_ids.get("bottom") == selected_role_ids.get("bottom"):
                return True

        current_top = self._extract_role_label(outfit_items, "top")
        current_bottom = self._extract_role_label(outfit_items, "bottom")
        recent_tops = [self._extract_role_label(day.get("clothing_items", []), "top") for day in history[-2:]]
        recent_bottoms = [self._extract_role_label(day.get("clothing_items", []), "bottom") for day in history[-2:]]

        if current_top and len(recent_tops) >= 2 and recent_tops[-1] == current_top and recent_tops[-2] == current_top:
            return True
        if current_bottom and len(recent_bottoms) >= 2 and recent_bottoms[-1] == current_bottom and recent_bottoms[-2] == current_bottom:
            return True

        return False

    def _matches_avoid_outfit(self, outfit: dict, avoid_outfit: Optional[dict]) -> bool:
        if not avoid_outfit:
            return False

        current_signature = self._build_outfit_signature(outfit.get("clothing_items", []))
        avoid_signature = self._build_outfit_signature(avoid_outfit.get("clothing_items", []))
        if current_signature == avoid_signature:
            return True

        current_role_ids = outfit.get("selected_role_ids", {})
        avoid_role_ids = avoid_outfit.get("selected_role_ids", {})
        if current_role_ids.get("top") and current_role_ids.get("top") == avoid_role_ids.get("top"):
            return True
        if current_role_ids.get("bottom") and current_role_ids.get("bottom") == avoid_role_ids.get("bottom"):
            return True

        return False

    def _allow_ai_repeat_when_wardrobe_is_limited(
        self,
        clothing_items: list[dict],
        outfit_items: list[str],
        history: list[dict],
        selected_role_ids: Optional[dict[str, Optional[str]]] = None,
        avoid_outfit: Optional[dict] = None,
    ) -> bool:
        if not history:
            return False

        def role_is_limited(role: str) -> bool:
            distinct_categories = self._get_distinct_categories_for_role(clothing_items, role)
            if len(distinct_categories) <= 1:
                return True

            unique_item_ids = {
                str(item.get("item_id"))
                for item in clothing_items
                if self._categorize_clothing(item) == role and item.get("item_id")
            }
            return len(unique_item_ids) <= 1

        current_signature = self._build_outfit_signature(outfit_items)
        previous_signature = self._build_outfit_signature(history[-1].get("clothing_items", []))
        if current_signature == previous_signature and not (role_is_limited("top") and role_is_limited("bottom")):
            return False

        current_role_ids = selected_role_ids or {}
        previous_role_ids = history[-1].get("selected_role_ids", {}) if history else {}

        top_repeat = False
        bottom_repeat = False

        if current_role_ids.get("top") and previous_role_ids.get("top") == current_role_ids.get("top"):
            top_repeat = True
        if current_role_ids.get("bottom") and previous_role_ids.get("bottom") == current_role_ids.get("bottom"):
            bottom_repeat = True

        current_top = self._extract_role_label(outfit_items, "top")
        current_bottom = self._extract_role_label(outfit_items, "bottom")
        recent_tops = [self._extract_role_label(day.get("clothing_items", []), "top") for day in history[-2:]]
        recent_bottoms = [self._extract_role_label(day.get("clothing_items", []), "bottom") for day in history[-2:]]

        if current_top and recent_tops and recent_tops[-1] == current_top:
            top_repeat = True
        if current_bottom and recent_bottoms and recent_bottoms[-1] == current_bottom:
            bottom_repeat = True
        if current_top and len(recent_tops) >= 2 and recent_tops[-1] == current_top and recent_tops[-2] == current_top:
            top_repeat = True
        if current_bottom and len(recent_bottoms) >= 2 and recent_bottoms[-1] == current_bottom and recent_bottoms[-2] == current_bottom:
            bottom_repeat = True

        if avoid_outfit:
            avoid_role_ids = avoid_outfit.get("selected_role_ids", {})
            if current_role_ids.get("top") and current_role_ids.get("top") == avoid_role_ids.get("top"):
                top_repeat = True
            if current_role_ids.get("bottom") and current_role_ids.get("bottom") == avoid_role_ids.get("bottom"):
                bottom_repeat = True

        if top_repeat and not role_is_limited("top"):
            return False
        if bottom_repeat and not role_is_limited("bottom"):
            return False

        return top_repeat or bottom_repeat or current_signature == previous_signature

    def _canonical_item_label(self, label: str) -> str:
        normalized = str(label).strip().lower()
        keyword_map = [
            ("t-shirt", "t-shirt"),
            ("tee", "t-shirt"),
            ("shirt", "shirt"),
            ("blouse", "shirt"),
            ("sweater", "sweater"),
            ("hoodie", "hoodie"),
            ("jacket", "jacket"),
            ("coat", "jacket"),
            ("cardigan", "jacket"),
            ("blazer", "jacket"),
            ("parka", "jacket"),
            ("raincoat", "jacket"),
            ("jeans", "jeans"),
            ("trouser", "pants"),
            ("pants", "pants"),
            ("shorts", "shorts"),
            ("skirt", "skirt"),
            ("dress", "dress"),
            ("boots", "boots"),
            ("boot", "boots"),
            ("sneakers", "sneakers"),
            ("sneaker", "sneakers"),
            ("sandals", "sandals"),
            ("sandal", "sandals"),
            ("shoes", "shoes"),
            ("shoe", "shoes"),
        ]

        for keyword, canonical in keyword_map:
            if keyword in normalized:
                return canonical

        return normalized

    def _select_primary_items_by_role(self, selected_items: list[dict]) -> dict[str, Optional[dict]]:
        role_items: dict[str, Optional[dict]] = {
            "top": None,
            "bottom": None,
            "dress": None,
            "outerwear": None,
            "shoes": None,
        }

        for item in selected_items:
            role = self._categorize_clothing(item)
            if role in role_items and role_items[role] is None:
                role_items[role] = item

        return role_items

    def _get_selected_role_ids(self, selected_items: list[dict]) -> dict[str, Optional[str]]:
        role_items = self._select_primary_items_by_role(selected_items)
        return {
            role: str(item.get("item_id")) if item and item.get("item_id") else None
            for role, item in role_items.items()
        }

    def _extract_role_label(self, clothing_items: list[str], role: str) -> Optional[str]:
        for label in clothing_items:
            if self._categorize_clothing({"category": label}) == role:
                return self._canonical_item_label(label)
        return None

    def _build_outfit_signature(self, clothing_items: list[str]) -> tuple[str, ...]:
        normalized = [self._canonical_item_label(item) for item in clothing_items if str(item).strip()]
        return tuple(sorted(normalized))

    def _normalize_recommended_items(self, recommended_labels: list[str], wardrobe_items: list[dict]) -> list[str]:
        available_categories: list[str] = []
        seen_categories: set[str] = set()

        for item in wardrobe_items:
            category = str(item.get("category", "")).strip()
            if category and category.lower() not in seen_categories:
                available_categories.append(category)
                seen_categories.add(category.lower())

        normalized_items: list[str] = []
        used_categories: set[str] = set()
        for label in recommended_labels:
            match = self._match_label_to_wardrobe_category(label, available_categories)
            if match and match.lower() not in used_categories:
                normalized_items.append(match)
                used_categories.add(match.lower())

        return normalized_items

    def _match_label_to_wardrobe_category(self, label: str, available_categories: list[str]) -> Optional[str]:
        canonical_label = self._canonical_item_label(label)
        if not canonical_label:
            return None

        partial_match: Optional[str] = None
        for category in available_categories:
            canonical_category = self._canonical_item_label(category)
            if canonical_category == canonical_label:
                return category
            if canonical_category and (canonical_category in canonical_label or canonical_label in canonical_category):
                partial_match = partial_match or category

        return partial_match

    def _match_labels_to_wardrobe_items(self, labels: list[str], wardrobe_items: list[dict]) -> list[dict]:
        matches: list[dict] = []
        used_item_ids: set[str] = set()

        for label in labels:
            canonical_label = self._canonical_item_label(label)
            selected_match: Optional[dict] = None

            for item in wardrobe_items:
                item_id = str(item.get("item_id", ""))
                if item_id and item_id in used_item_ids:
                    continue

                canonical_category = self._canonical_item_label(item.get("category", ""))
                if not canonical_category:
                    continue

                if canonical_category == canonical_label or canonical_category in canonical_label or canonical_label in canonical_category:
                    selected_match = item
                    break

            if selected_match is not None:
                matches.append(selected_match)
                if selected_match.get("item_id"):
                    used_item_ids.add(str(selected_match.get("item_id")))

        return matches

    def _build_ai_outfit_for_day(
        self,
        clothing_items: list[dict],
        day_forecast: dict,
        day_num: int,
        history: Optional[list[dict]] = None,
    ) -> Optional[dict]:
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
                "recent_days": [
                    {
                        "day": previous.get("day"),
                        "clothing_items": previous.get("clothing_items", []),
                    }
                    for previous in (history or [])[-2:]
                ],
                "available_by_role": {
                    "tops": self._get_distinct_categories_for_role(clothing_items, "top"),
                    "bottoms": self._get_distinct_categories_for_role(clothing_items, "bottom"),
                    "dresses": self._get_distinct_categories_for_role(clothing_items, "dress"),
                    "outerwear": self._get_distinct_categories_for_role(clothing_items, "outerwear"),
                    "shoes": self._get_distinct_categories_for_role(clothing_items, "shoes"),
                },
                "rules": [
                    "Use only clothing categories that exist in wardrobe.",
                    "Return a safe option for weather conditions.",
                    "Weather suitability is more important than variety.",
                    "Avoid repeating the exact same full outfit as the previous day when a real alternative exists.",
                    "Avoid using the same top or bottom for a third consecutive day unless the wardrobe is too limited.",
                    "If only one usable top or bottom exists, repetition is acceptable and you should still return the best AI outfit for that day.",
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
            clothing_items_out = self._normalize_recommended_items(clothing_items_out, clothing_items)
            if not clothing_items_out:
                return None

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

            matched_items = self._match_labels_to_wardrobe_items(clothing_items_out, clothing_items)
            selected_item_ids = [str(item.get("item_id")) for item in matched_items if item.get("item_id")]
            selected_role_ids = self._get_selected_role_ids(matched_items)

            return {
                "day": day_num,
                "date": day_forecast.get("date"),
                "outfit_description": outfit_description,
                "clothing_items": clothing_items_out,
                "selected_item_ids": selected_item_ids,
                "selected_role_ids": selected_role_ids,
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
        dress: Optional[dict],
        outerwear: Optional[dict],
        shoes: Optional[dict],
        selected_items: list[dict],
    ) -> tuple[bool, Optional[str]]:
        """Evaluate whether wardrobe can support a safe and suitable outfit for the day."""
        if not dress and (not top or not bottom):
            return False, "No complete outfit available (missing a proper top and bottom, or a dress) for this day."

        if self._is_very_cold_or_snow(temp, condition):
            has_warm_layer = any(
                self._normalize_warmth_level(item.get("warmth_level", "")) in {"warm", "moderate"}
                for item in selected_items
            )
            has_boots = shoes is not None and "boot" in str(shoes.get("category", "")).lower()
            if not outerwear or not has_warm_layer or not has_boots:
                return False, "Very cold or snowy day needs coat/warm layers/boots, but wardrobe is missing one or more."

        if self._is_rainy(condition):
            rain_outerwear = outerwear is not None and (
                self._weather_suitability_matches(str(outerwear.get("weather_suitability", "")), condition, temp)
                or any(token in str(outerwear.get("category", "")).lower() for token in ["rain", "jacket", "coat"])
            )
            rain_shoes = shoes is not None and (
                self._weather_suitability_matches(str(shoes.get("weather_suitability", "")), condition, temp)
                or any(token in str(shoes.get("category", "")).lower() for token in ["boot", "shoe", "sneaker"])
            )
            if not rain_outerwear or not rain_shoes:
                return False, "Rain expected but no suitable rain outerwear or shoes were found."

        if temp >= 30 and selected_items:
            all_heavy = all(
                self._normalize_warmth_level(item.get("warmth_level", "")) == "warm"
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

    def _weather_suitability_matches(self, suitability: str, condition: str, temp: int) -> bool:
        if not suitability:
            return True

        normalized = suitability.lower()
        if any(token in normalized for token in ["all", "any", "variable"]):
            return True

        if self._is_rainy(condition) and any(token in normalized for token in ["rain", "fall", "winter"]):
            return True

        if temp >= 22 and any(token in normalized for token in ["spring", "summer"]):
            return True

        if temp < 16 and any(token in normalized for token in ["fall", "winter"]):
            return True

        return False

    def _normalize_warmth_level(self, warmth_level: str) -> str:
        normalized = str(warmth_level or "").strip().lower()
        mapping = {
            "heavy": "warm",
            "warm": "warm",
            "medium": "moderate",
            "moderate": "moderate",
            "light": "light",
        }
        return mapping.get(normalized, "moderate")

    def _categorize_clothing(self, clothing_item: dict) -> str:
        category = str(clothing_item.get("category", "")).lower()

        if category in self.SHOES or any(keyword in category for keyword in ["shoe", "boot", "sandal", "sneaker"]):
            return "shoes"
        if category in self.DRESSES or any(keyword in category for keyword in ["dress", "jumpsuit", "romper", "overall"]):
            return "dress"
        if category in self.BOTTOMS or any(keyword in category for keyword in ["pant", "short", "skirt", "leg"]):
            return "bottom"
        if any(keyword in category for keyword in ["jacket", "coat", "cardigan", "blazer", "parka", "raincoat"]):
            return "outerwear"
        if any(keyword in category for keyword in self.ACCESSORIES):
            return "accessory"
        if category in self.TOPS or any(keyword in category for keyword in ["shirt", "top", "blouse", "sweater", "hoodie", "tee", "tank", "polo"]):
            return "top"

        return "other"

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
