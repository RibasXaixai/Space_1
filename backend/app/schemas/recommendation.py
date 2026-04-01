from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.clothing import ClothingItemOut


class RecommendationItemOut(BaseModel):
    id: int
    role: str
    clothing_item: ClothingItemOut

    model_config = {
        "from_attributes": True,
    }


class RecommendationOut(BaseModel):
    id: int
    date: date
    weather_summary: str
    explanation: str
    viability_status: str
    feedback: Optional[str] = None
    is_favorite: bool = False
    items: List[RecommendationItemOut]
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class RecommendationAnalyticsItem(BaseModel):
    name: str
    count: int


class RecommendationAnalyticsOut(BaseModel):
    total_recommendations: int
    liked: int
    disliked: int
    top_liked_categories: List[RecommendationAnalyticsItem]
    top_disliked_categories: List[RecommendationAnalyticsItem]
    top_liked_styles: List[RecommendationAnalyticsItem]
    top_disliked_styles: List[RecommendationAnalyticsItem]

    model_config = {
        "from_attributes": True,
    }
