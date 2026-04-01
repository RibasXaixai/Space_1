import type { Recommendation } from "../types";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onFeedback: (recommendationId: number, feedback: "liked" | "disliked") => void;
  onFavorite?: (recommendationId: number, favorite: boolean) => void;
}

export default function RecommendationCard({ recommendation, onFeedback, onFavorite }: RecommendationCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{recommendation.date}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{recommendation.weather_summary}</h3>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            recommendation.viability_status === "viable"
              ? "bg-emerald-100 text-emerald-700"
              : recommendation.viability_status === "warning"
              ? "bg-amber-100 text-amber-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {recommendation.viability_status.replace("_", " ")}
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-600">{recommendation.explanation}</p>

      <div className="mt-6 space-y-4">
        {recommendation.items.map((item) => (
          <div key={item.id} className="rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-200">
                <img
                  src={`${import.meta.env.VITE_API_URL || ""}${item.clothing_item.image_url}`}
                  alt={item.role}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm text-slate-500">{item.role}</p>
                <p className="text-base font-semibold text-slate-900">{item.clothing_item.category || "Unknown"}</p>
                <p className="text-sm text-slate-500">{item.clothing_item.style || "No style"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {recommendation.feedback ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
            Your feedback: <span className="font-semibold text-slate-900">{recommendation.feedback}</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              onClick={() => onFeedback(recommendation.id, "liked")}
            >
              Like
            </button>
            <button
              type="button"
              className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              onClick={() => onFeedback(recommendation.id, "disliked")}
            >
              Dislike
            </button>
          </div>
        )}

        {onFavorite ? (
          <button
            type="button"
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            onClick={() => onFavorite(recommendation.id, !recommendation.is_favorite)}
          >
            {recommendation.is_favorite ? "Unsave outfit" : "Save outfit"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
