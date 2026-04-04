import { api } from "./api";
import type {
  RecommendationRefreshDayRequest,
  RecommendationRefreshDayResponse,
  RecommendationRefreshWeekRequest,
  RecommendationRefreshWeekResponse,
  RecommendationsGenerateRequest,
  RecommendationsGenerateResponse,
  SendPlanEmailRequest,
  SendPlanEmailResponse,
  WeatherForecastRequest,
  WeatherForecastResponse,
} from "../types/phase2";

export function getWeatherForecastPhase2(payload: WeatherForecastRequest) {
  return api.post<WeatherForecastResponse>("/weather/forecast", payload);
}

export function generateRecommendationsPhase2(payload: RecommendationsGenerateRequest) {
  return api.post<RecommendationsGenerateResponse>("/recommendations/generate", payload);
}

export function refreshRecommendationDayPhase2(payload: RecommendationRefreshDayRequest) {
  return api.post<RecommendationRefreshDayResponse>("/recommendations/refresh-day", payload);
}

export function refreshRecommendationWeekPhase2(payload: RecommendationRefreshWeekRequest) {
  return api.post<RecommendationRefreshWeekResponse>("/recommendations/refresh-week", payload);
}

export function uploadClothingPhase2(formData: FormData) {
  return api.post("/upload-clothing", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export function checkDuplicatesPhase2(items: { id: string; file_path: string }[]) {
  return api.post("/check-duplicates", { items });
}

export function sendPlanEmailPhase2(payload: SendPlanEmailRequest) {
  return api.post<SendPlanEmailResponse>("/recommendations/email-plan", payload);
}
