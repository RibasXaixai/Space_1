from pydantic import BaseModel
from typing import Optional


class UploadedClothingItemSchema(BaseModel):
    """Schema for a single uploaded clothing item with its analysis."""
    id: str
    file_path: str
    category: str
    color: str
    style: str
    warmth_level: str
    weather_suitability: str
    notes: str


class ClothingUploadResponse(BaseModel):
    """Response from uploading clothing items."""
    success: bool
    items: list[UploadedClothingItemSchema]
    message: Optional[str] = None
