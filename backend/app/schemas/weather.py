from pydantic import BaseModel


class WeatherDay(BaseModel):
    date: str
    condition: str | None = None
    max_temp_c: float | None = None
    min_temp_c: float | None = None


class WeatherForecast(BaseModel):
    location: str
    forecast: list[WeatherDay]
