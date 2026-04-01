import { api } from "./api";
import type { Recommendation, RecommendationAnalytics } from "../types";

export function getNextRecommendations(token: string) {
  return api.get<Recommendation[]>("/recommendations/next-5-days", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getSavedRecommendations(token: string) {
  return api.get<Recommendation[]>("/recommendations/saved", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function exportSavedRecommendations(token: string) {
  return api.get<Blob>("/recommendations/saved/export", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: "blob",
  });
}

export function setRecommendationFavorite(
  token: string,
  recommendationId: number,
  favorite: boolean
) {
  return api.post<Recommendation>(
    `/recommendations/${recommendationId}/favorite`,
    { favorite },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

export function getRecommendationAnalytics(token: string) {
  return api.get<RecommendationAnalytics>("/recommendations/analytics", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function submitRecommendationFeedback(
  token: string,
  recommendationId: number,
  feedback: "liked" | "disliked"
) {
  return api.post<Recommendation>(
    `/recommendations/${recommendationId}/feedback`,
    { feedback },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
