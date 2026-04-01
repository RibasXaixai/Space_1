export type ClothingItemStatus = "analyzed" | "needs_review" | "rejected";

export interface UploadedClothing {
  id: string;
  file: File;
  preview: string;
  file_path?: string;
  analysis_source?: "ai" | "fallback";
  status?: ClothingItemStatus;
  review_reason?: string;
  review_issue?: string;
  reject_reason?: string;
  validation_warning?: string;  // Non-blocking hint (e.g., below recommended resolution)
  analyzed?: ClothingAnalysis;
  is_exact_duplicate?: boolean;
  is_similar_duplicate?: boolean;
}

export interface ClothingAnalysis {
  category: string;
  color: string;
  style: string;
  warmth_level: string;
  weather_suitability: string;
  gender: "Male" | "Female" | "Unisex" | string;
  notes: string;
  confidence_score?: number;
}

export interface Recommendation {
  day: number;
  date: string;
  outfit_description: string;
  clothing_items: string[];
  weather_match: string;
  confidence: number;
  recommendation_source?: "ai" | "rule-based" | string;
  is_viable: boolean;
  day_warning?: string;
}

export interface WeatherForecast {
  day: number;
  date: string;
  temperature: number;
  condition: string;
  humidity: number;
}

export interface AnalyzeClothesRequest {
  clothing_ids: string[];
}

export interface AnalyzeClothesResponse {
  success: boolean;
  analyses: ClothingAnalysis[];
  message?: string;
}

export interface WeatherForecastRequest {
  location: string;
  days: number;
}

export interface WeatherForecastResponse {
  success: boolean;
  location: string;
  forecast: WeatherForecast[];
  message?: string;
}

export interface RecommendationsGenerateRequest {
  clothing_data: ClothingAnalysis[];
  weather_forecast: WeatherForecast[];
  location: string;
}

export interface RecommendationsGenerateResponse {
  success: boolean;
  recommendations: Recommendation[];
  warnings: string[];
  message?: string;
}

export interface RecommendationRefreshDayRequest {
  day: number;
  clothing_data: ClothingAnalysis[];
  weather_forecast: WeatherForecast[];
  location: string;
}

export interface RecommendationRefreshDayResponse {
  success: boolean;
  recommendation: Recommendation;
  message?: string;
}
