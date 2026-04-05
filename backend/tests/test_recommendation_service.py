from app.schemas.phase2 import ClothingAnalysisSchema, WeatherForecastSchema
from app.services.recommendation_service import RecommendationService


def _clothing_items() -> list[ClothingAnalysisSchema]:
    return [
        ClothingAnalysisSchema(
            item_id="top-1",
            category="Shirt",
            color="Blue",
            style="Casual",
            warmth_level="Medium",
            weather_suitability="Spring",
            gender="Unisex",
            notes="",
        ),
        ClothingAnalysisSchema(
            item_id="bottom-1",
            category="Jeans",
            color="Black",
            style="Casual",
            warmth_level="Medium",
            weather_suitability="Spring",
            gender="Unisex",
            notes="",
        ),
        ClothingAnalysisSchema(
            item_id="shoe-1",
            category="Sneakers",
            color="White",
            style="Casual",
            warmth_level="Light",
            weather_suitability="Spring",
            gender="Unisex",
            notes="",
        ),
    ]


def _forecast() -> list[WeatherForecastSchema]:
    return [
        WeatherForecastSchema(day=1, date="2026-04-05", temperature=18, condition="Sunny", humidity=55),
        WeatherForecastSchema(day=2, date="2026-04-06", temperature=17, condition="Cloudy", humidity=60),
        WeatherForecastSchema(day=3, date="2026-04-07", temperature=19, condition="Sunny", humidity=52),
        WeatherForecastSchema(day=4, date="2026-04-08", temperature=16, condition="Cloudy", humidity=64),
        WeatherForecastSchema(day=5, date="2026-04-09", temperature=18, condition="Sunny", humidity=58),
    ]


def test_ai_recommendations_are_kept_when_repeats_are_unavoidable() -> None:
    service = RecommendationService()

    def fake_ai_outfit(clothing_items, day_forecast, day_num, history):
        return {
            "day": day_num,
            "date": day_forecast.get("date"),
            "outfit_description": f"AI look for day {day_num}",
            "clothing_items": ["Shirt", "Jeans", "Sneakers"],
            "selected_item_ids": ["top-1", "bottom-1", "shoe-1"],
            "selected_role_ids": {
                "top": "top-1",
                "bottom": "bottom-1",
                "dress": None,
                "outerwear": None,
                "shoes": "shoe-1",
            },
            "weather_match": "Mild, 18C",
            "confidence": 0.82,
            "recommendation_source": "ai",
            "is_viable": True,
            "day_warning": None,
        }

    service._build_ai_outfit_for_day = fake_ai_outfit  # type: ignore[method-assign]

    result = service.generate_recommendations(_clothing_items(), _forecast(), "London")

    assert [rec["recommendation_source"] for rec in result["recommendations"]] == ["ai", "ai", "ai", "ai", "ai"]


def test_ai_rainy_day_is_completed_with_weather_safe_items_when_available() -> None:
    service = RecommendationService()
    rainy_wardrobe = _clothing_items() + [
        ClothingAnalysisSchema(
            item_id="outer-1",
            category="Jacket",
            color="Grey",
            style="Casual",
            warmth_level="Warm",
            weather_suitability="Rain",
            gender="Unisex",
            notes="",
        ),
        ClothingAnalysisSchema(
            item_id="boot-1",
            category="Boots",
            color="Brown",
            style="Casual",
            warmth_level="Warm",
            weather_suitability="Rain",
            gender="Unisex",
            notes="",
        ),
    ]
    rainy_forecast = [
        WeatherForecastSchema(
            day=1,
            date="2026-04-05",
            temperature=15,
            condition="Rain",
            humidity=80,
            chance_of_rain=90,
            wind_kph=18,
        )
    ]

    def fake_ai_outfit(clothing_items, day_forecast, day_num, history):
        return {
            "day": day_num,
            "date": day_forecast.get("date"),
            "outfit_description": "AI suggested a simple rainy-day look.",
            "clothing_items": ["Shirt", "Jeans"],
            "selected_item_ids": ["top-1", "bottom-1"],
            "selected_role_ids": {
                "top": "top-1",
                "bottom": "bottom-1",
                "dress": None,
                "outerwear": None,
                "shoes": None,
            },
            "weather_match": "Rain, 15C",
            "confidence": 0.8,
            "recommendation_source": "ai",
            "is_viable": True,
            "day_warning": None,
        }

    service._build_ai_outfit_for_day = fake_ai_outfit  # type: ignore[method-assign]

    result = service.generate_recommendations(rainy_wardrobe, rainy_forecast, "London")
    recommendation = result["recommendations"][0]

    assert recommendation["recommendation_source"] == "ai"
    assert "Jacket" in recommendation["clothing_items"]
    assert "Boots" in recommendation["clothing_items"]
    assert recommendation["is_viable"] is True
