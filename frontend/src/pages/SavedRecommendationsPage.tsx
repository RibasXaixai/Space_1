import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { exportSavedRecommendations, getSavedRecommendations, setRecommendationFavorite } from "../services/recommendations";
import RecommendationCard from "../components/RecommendationCard";
import type { Recommendation } from "../types";

export default function SavedRecommendationsPage() {
  const { token } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getSavedRecommendations(token)
      .then((response) => setRecommendations(response.data))
      .catch(() => setError("Unable to load saved outfits."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFavorite = (recommendationId: number, favorite: boolean) => {
    if (!token) {
      return;
    }

    setError(null);

    setRecommendationFavorite(token, recommendationId, favorite)
      .then((response) => {
        setRecommendations((current) =>
          current.filter((recommendation) => recommendation.id !== recommendationId)
        );
      })
      .catch(() => setError("Unable to update saved outfit."));
  };

  const handleExport = () => {
    if (!token) {
      return;
    }

    setExportError(null);

    exportSavedRecommendations(token)
      .then((response) => {
        const url = URL.createObjectURL(response.data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `saved-outfits-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => setExportError("Unable to export saved outfits."));
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Saved Outfits</h2>
            <p className="mt-2 text-slate-600">Review and manage outfits you've saved from recommendations.</p>
          </div>
          <button
            type="button"
            disabled={recommendations.length === 0}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleExport}
          >
            Export saved outfits
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">Loading saved outfits...</div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-slate-700">{error}</div>
      ) : null}

      {exportError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-slate-700">{exportError}</div>
      ) : null}

      {!loading && !error && recommendations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No saved outfits yet. Save outfits from the recommendations page to see them here.
        </div>
      ) : null}

      <div className="grid gap-6">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            onFeedback={() => {}}
            onFavorite={handleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
