from pydantic import BaseModel
from typing import Optional


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


class WeatherForecastRequest(BaseModel):
    location: str
    days: int = 5


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
    weather_match: str
    confidence: float
    recommendation_source: str = "rule-based"
    is_viable: bool = True
    day_warning: Optional[str] = None


class RecommendationsGenerateRequest(BaseModel):
    clothing_data: list[ClothingAnalysisSchema]
    weather_forecast: list[WeatherForecastSchema]
    location: str


class RecommendationsGenerateResponse(BaseModel):
    success: bool
    recommendations: list[RecommendationSchema]
    warnings: list[str] = []
    message: Optional[str] = None


class RecommendationRefreshDayRequest(BaseModel):
    day: int
    clothing_data: list[ClothingAnalysisSchema]
    weather_forecast: list[WeatherForecastSchema]
    location: str


class RecommendationRefreshDayResponse(BaseModel):
    success: bool
    recommendation: RecommendationSchema
    message: Optional[str] = None


class RecommendationRefreshWeekRequest(BaseModel):
    clothing_data: list[ClothingAnalysisSchema]
    weather_forecast: list[WeatherForecastSchema]
    location: str
    current_recommendations: list[RecommendationSchema] = []


class RecommendationRefreshWeekResponse(BaseModel):
    success: bool
    recommendations: list[RecommendationSchema]
    warnings: list[str] = []
    message: Optional[str] = None
