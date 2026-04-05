from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.input_validation import sanitize_email, sanitize_location


class ClothingAnalysisSchema(BaseModel):
    item_id: Optional[str] = None
    status: str = "analyzed"
    category: str
    color: str
    style: str
    warmth_level: str
    weather_suitability: str
    gender: str = "Unisex"
    notes: str
    confidence_score: float = 100.0


class AnalyzeClothesRequest(BaseModel):
    clothing_ids: list[str]


class AnalyzeClothesResponse(BaseModel):
    success: bool
    analyses: list[ClothingAnalysisSchema]
    message: Optional[str] = None


class WeatherForecastSchema(BaseModel):
    day: int
    date: str
    temperature: int
    condition: str
    humidity: int
    chance_of_rain: int = 0
    wind_kph: int = 0
    condition_icon: str = ""


class LocationBoundRequest(BaseModel):
    location: str = Field(..., max_length=120)

    @field_validator("location")
    @classmethod
    def validate_location(cls, value: str) -> str:
        return sanitize_location(value)


class WeatherForecastRequest(LocationBoundRequest):
    days: int = Field(default=5, ge=1, le=7)


class WeatherForecastResponse(BaseModel):
    success: bool
    location: str
    forecast: list[WeatherForecastSchema]
    message: Optional[str] = None


class RecommendationSchema(BaseModel):
    day: int
    date: str
    outfit_description: str
    clothing_items: list[str]
    selected_item_ids: list[str] = []
    selected_role_ids: dict[str, Optional[str]] = {}
    weather_match: str
    confidence: float
    recommendation_source: str = "rule-based"
    is_viable: bool = True
    day_warning: Optional[str] = None


class RecommendationsGenerateRequest(LocationBoundRequest):
    clothing_data: list[ClothingAnalysisSchema]
    weather_forecast: list[WeatherForecastSchema]


class RecommendationsGenerateResponse(BaseModel):
    success: bool
    recommendations: list[RecommendationSchema]
    warnings: list[str] = []
    message: Optional[str] = None


class RecommendationRefreshDayRequest(LocationBoundRequest):
    day: int = Field(..., ge=1, le=7)
    clothing_data: list[ClothingAnalysisSchema]
    weather_forecast: list[WeatherForecastSchema]
    current_recommendation: Optional[RecommendationSchema] = None


class RecommendationRefreshDayResponse(BaseModel):
    success: bool
    recommendation: RecommendationSchema
    message: Optional[str] = None


class RecommendationRefreshWeekRequest(LocationBoundRequest):
    clothing_data: list[ClothingAnalysisSchema]
    weather_forecast: list[WeatherForecastSchema]
    current_recommendations: list[RecommendationSchema] = []


class RecommendationRefreshWeekResponse(BaseModel):
    success: bool
    recommendations: list[RecommendationSchema]
    warnings: list[str] = []
    message: Optional[str] = None


class SendPlanWardrobeItemSchema(BaseModel):
    id: str
    file_path: Optional[str] = None
    category: str
    color: str
    gender: str = "Unisex"
    image_data_url: Optional[str] = None


class SendPlanEmailRequest(LocationBoundRequest):
    email: str = Field(..., max_length=254)
    weather_forecast: list[WeatherForecastSchema]
    recommendations: list[RecommendationSchema]
    warnings: list[str] = []
    wardrobe_items: list[SendPlanWardrobeItemSchema] = []

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return sanitize_email(value)


class SendPlanEmailResponse(BaseModel):
    success: bool
    message: Optional[str] = None
