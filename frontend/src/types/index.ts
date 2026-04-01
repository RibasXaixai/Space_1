export interface HealthResponse {
  status: string;
}

export interface User {
  id: number;
  email: string;
  location?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: LoginForm) => Promise<void>;
  register: (data: RegisterForm) => Promise<void>;
  logout: () => void;
}

export interface ClothingItem {
  id: number;
  user_id: number;
  image_url: string;
  category?: string | null;
  color?: string | null;
  style?: string | null;
  warmth_level?: string | null;
  weather_suitability?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface ClothingUpdatePayload {
  category?: string;
  color?: string;
  style?: string;
  warmth_level?: string;
  weather_suitability?: string;
  notes?: string;
}

export interface RecommendationItem {
  id: number;
  role: string;
  clothing_item: ClothingItem;
}

export interface Recommendation {
  id: number;
  date: string;
  weather_summary: string;
  explanation: string;
  viability_status: string;
  feedback?: "liked" | "disliked" | null;
  is_favorite?: boolean;
  items: RecommendationItem[];
  created_at: string;
}

export interface RecommendationAnalyticsItem {
  name: string;
  count: number;
}

export interface RecommendationAnalytics {
  total_recommendations: number;
  liked: number;
  disliked: number;
  top_liked_categories: RecommendationAnalyticsItem[];
  top_disliked_categories: RecommendationAnalyticsItem[];
  top_liked_styles: RecommendationAnalyticsItem[];
  top_disliked_styles: RecommendationAnalyticsItem[];
}

export interface LocationPayload {
  location: string;
}

export interface WeatherDay {
  date: string;
  condition?: string | null;
  max_temp_c?: number | null;
  min_temp_c?: number | null;
}

export interface WeatherForecast {
  location: string;
  forecast: WeatherDay[];
}
