import os
from typing import Optional
import requests


class WeatherService:
    """Service for fetching weather data from WeatherAPI.com."""

    def __init__(self):
        self.api_key = os.getenv("WEATHER_API_KEY")
        if not self.api_key:
            raise ValueError("WEATHER_API_KEY environment variable is not set")
        
        self.base_url = "https://api.weatherapi.com/v1"
        self.timeout = 10

    def get_forecast(self, location: str, days: int = 5) -> Optional[dict]:
        """
        Get weather forecast for a location.
        
        Args:
            location: Location name or coordinates (e.g., "New York", "London", "48.8566,2.3522")
            days: Number of days to forecast (1-10, default 5)
            
        Returns:
            Dictionary with forecast data or None if request fails
        """
        try:
            # Ensure days is within valid range
            days = max(1, min(days, 10))
            
            # Build API request
            params = {
                "key": self.api_key,
                "q": location,
                "days": days,
                "aqi": "no",
                "alerts": "no",
            }
            
            response = requests.get(
                f"{self.base_url}/forecast.json",
                params=params,
                timeout=self.timeout,
            )
            
            response.raise_for_status()
            data = response.json()
            
            return self._parse_forecast(data)
        
        except requests.exceptions.Timeout:
            print(f"Weather API request timed out for location: {location}")
            return None
        except requests.exceptions.HTTPError as e:
            print(f"Weather API HTTP error: {e.response.status_code}")
            return None
        except Exception as e:
            print(f"Weather service error: {str(e)}")
            return None

    def _parse_forecast(self, data: dict) -> dict:
        """Parse WeatherAPI response into simplified forecast format."""
        try:
            location_data = data.get("location", {})
            forecast_data = data.get("forecast", {})
            forecast_days = forecast_data.get("forecastday", [])
            
            region = location_data.get("region")
            country = location_data.get("country")
            location_str = location_data.get("name")
            
            if region:
                location_str = f"{location_str}, {region}"
            if country:
                location_str = f"{location_str}, {country}"
            
            days = []
            for idx, day_data in enumerate(forecast_days[:5], 1):
                day_obj = day_data.get("day", {})
                condition_obj = day_obj.get("condition", {})
                
                days.append({
                    "day": idx,
                    "date": day_data.get("date"),
                    "min_temp": round(day_obj.get("mintemp_c", 0)),
                    "max_temp": round(day_obj.get("maxtemp_c", 0)),
                    "condition": condition_obj.get("text", "Unknown"),
                    "condition_icon": condition_obj.get("icon", ""),
                    "chance_of_rain": day_obj.get("daily_chance_of_rain", 0),
                    "snow_indicator": day_obj.get("daily_chance_of_snow", 0),
                    "wind_kph": round(day_obj.get("maxwind_kph", 0)),
                    "humidity": day_obj.get("avg_humidity", 0),
                })
            
            return {
                "location": location_str,
                "latitude": location_data.get("lat"),
                "longitude": location_data.get("lon"),
                "timezone": location_data.get("tz_id"),
                "forecast": days,
            }
        
        except Exception as e:
            print(f"Error parsing weather forecast: {str(e)}")
            return None
