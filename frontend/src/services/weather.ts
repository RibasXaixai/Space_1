import { api } from "./api";
import type { WeatherForecast } from "../types";

export function getWeatherForecast(token: string) {
  return api.get<WeatherForecast>("/weather/forecast", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
