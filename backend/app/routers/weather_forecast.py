from fastapi import APIRouter, HTTPException
from app.schemas.phase2 import (
    WeatherForecastRequest,
    WeatherForecastResponse,
    WeatherForecastSchema,
)
from app.services.weather_service import WeatherService

router = APIRouter()

# Initialize weather service once
try:
    weather_service = WeatherService()
    weather_available = True
except ValueError:
    print("Warning: WEATHER_API_KEY not configured. Weather service will be unavailable.")
    weather_service = None
    weather_available = False


@router.post("/forecast", response_model=WeatherForecastResponse)
def get_forecast(request: WeatherForecastRequest):
    """
    Get weather forecast for a location.
    
    Args:
        request: WeatherForecastRequest with location and days
        
    Returns:
        WeatherForecastResponse with 5-day forecast data
    """
    if not weather_available or weather_service is None:
        raise HTTPException(
            status_code=503,
            detail="Weather service is not configured. Please set WEATHER_API_KEY environment variable.",
        )
    
    if not request.location.strip():
        raise HTTPException(
            status_code=400,
            detail="Location is required.",
        )
    
    forecast_data = weather_service.get_forecast(request.location, request.days)
    
    if forecast_data is None:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to fetch weather forecast for location: {request.location}",
        )
    
    # Convert parsed data to response schema
    forecast_schemas = [
        WeatherForecastSchema(
            day=day["day"],
            date=day["date"],
            temperature=day["max_temp"],
            condition=day["condition"],
            humidity=day["humidity"],
            chance_of_rain=day.get("chance_of_rain", 0),
            wind_kph=day.get("wind_kph", 0),
            condition_icon=day.get("condition_icon", ""),
        )
        for day in forecast_data.get("forecast", [])
    ]
    
    return WeatherForecastResponse(
        success=True,
        location=forecast_data["location"],
        forecast=forecast_schemas,
        message=f"Successfully retrieved forecast for {request.location}.",
    )
