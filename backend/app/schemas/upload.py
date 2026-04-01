from pydantic import BaseModel
from typing import Optional


class CheckDuplicatesRequestItem(BaseModel):
    """Single item to check for duplicates."""
    id: str
    file_path: str


class CheckDuplicatesRequest(BaseModel):
    """Request body for duplicate checking."""
    items: list[CheckDuplicatesRequestItem]


class DuplicateResultItem(BaseModel):
    """Duplicate detection result for a single item."""
    id: str
    is_exact_duplicate: bool
    is_similar_duplicate: bool


class CheckDuplicatesResponse(BaseModel):
    """Response for the check-duplicates endpoint."""
    success: bool
    results: list[DuplicateResultItem]


class UploadedClothingItemSchema(BaseModel):
    """Schema for a single uploaded clothing item with its analysis."""
    id: str
    file_path: str
    analysis_source: str
    # status: 'analyzed' | 'needs_review' | 'rejected'
    status: str
    review_reason: Optional[str] = None
    review_issue: Optional[str] = None
    reject_reason: Optional[str] = None
    category: str
    color: str
    style: str
    warmth_level: str
    weather_suitability: str
    gender: str
    notes: str


class ClothingUploadResponse(BaseModel):
    """Response from uploading clothing items."""
    success: bool
    items: list[UploadedClothingItemSchema]
    message: Optional[str] = None
