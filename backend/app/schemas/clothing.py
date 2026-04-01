from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClothingItemBase(BaseModel):
    category: Optional[str] = None
    color: Optional[str] = None
    style: Optional[str] = None
    warmth_level: Optional[str] = None
    weather_suitability: Optional[str] = None
    notes: Optional[str] = None


class ClothingItemCreate(ClothingItemBase):
    image_url: str


class ClothingItemUpdate(ClothingItemBase):
    pass


class ClothingItemOut(ClothingItemBase):
    id: int
    user_id: int
    image_url: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class ClothingAnalysisOut(BaseModel):
    image_url: str
    category: str
    color: str
    style: str
    warmth_level: str
    weather_suitability: str
    notes: str
    recommendation: str
