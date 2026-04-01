from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers.auth import get_current_user
from app.services.weather_service import fetch_weather_forecast
from app.schemas.weather import WeatherForecast

router = APIRouter()


@router.get("/forecast", response_model=WeatherForecast)
def get_forecast(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.location:
        raise HTTPException(status_code=400, detail="User location is not set.")

    weather_data = fetch_weather_forecast(current_user.location)
    return weather_data
