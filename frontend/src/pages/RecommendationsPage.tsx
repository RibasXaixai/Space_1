import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getNextRecommendations, setRecommendationFavorite, submitRecommendationFeedback } from "../services/recommendations";
import RecommendationCard from "../components/RecommendationCard";
import type { Recommendation } from "../types";

export default function RecommendationsPage() {
  const { token } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getNextRecommendations(token)
      .then((response) => setRecommendations(response.data))
      .catch(() => setError("Unable to load recommendations."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFeedback = (recommendationId: number, feedback: "liked" | "disliked") => {
    if (!token) {
      return;
    }

    setFeedbackError(null);

    submitRecommendationFeedback(token, recommendationId, feedback)
      .then((response) => {
        setRecommendations((current) =>
          current.map((recommendation) =>
            recommendation.id === recommendationId ? response.data : recommendation
          )
        );
      })
      .catch(() => setFeedbackError("Unable to send feedback. Please try again."));
  };

  const handleFavorite = (recommendationId: number, favorite: boolean) => {
    if (!token) {
      return;
    }

    setFeedbackError(null);

    setRecommendationFavorite(token, recommendationId, favorite)
      .then((response) => {
        setRecommendations((current) =>
          current.map((recommendation) =>
            recommendation.id === recommendationId ? response.data : recommendation
          )
        );
      })
      .catch(() => setFeedbackError("Unable to update favorite status. Please try again."));
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Next 5 Days</h2>
          <p className="mt-2 text-slate-600">Daily outfit recommendations based on your wardrobe and weather forecast.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">Loading recommendations...</div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-slate-700">{error}</div>
      ) : null}

      {feedbackError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-slate-700">{feedbackError}</div>
      ) : null}

      {!loading && !error && recommendations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No recommendations available. Try setting your location and uploading wardrobe items.
        </div>
      ) : null}

      <div className="grid gap-6">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            onFeedback={handleFeedback}
            onFavorite={handleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
