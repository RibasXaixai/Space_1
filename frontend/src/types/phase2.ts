export interface UploadedClothing {
  id: string;
  file: File;
  preview: string;
  analysis_source?: "ai" | "fallback";
  analyzed?: ClothingAnalysis;
}

export interface ClothingAnalysis {
  category: string;
  color: string;
  style: string;
  warmth_level: string;
  weather_suitability: string;
  notes: string;
}

export interface Recommendation {
  day: number;
  date: string;
  outfit_description: string;
  clothing_items: string[];
  weather_match: string;
  confidence: number;
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
