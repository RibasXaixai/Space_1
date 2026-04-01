import type { Recommendation } from "../types/phase2";

interface RecommendationCardProps {
  recommendation: Recommendation;
}

function weatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("sun") || c.includes("clear")) return "☀️";
  if (c.includes("snow") || c.includes("sleet") || c.includes("blizzard")) return "❄️";
  if (c.includes("thunder") || c.includes("storm")) return "⛈️";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "🌧️";
  if (c.includes("fog") || c.includes("mist")) return "🌫️";
  if (c.includes("partly") || c.includes("partial")) return "⛅";
  if (c.includes("cloud") || c.includes("overcast")) return "☁️";
  return "🌤️";
}

function parseWeatherMatch(weatherMatch: string): { condition: string; temp: string } {
  const parts = weatherMatch.split(",");
  const condition = parts[0]?.trim() || weatherMatch;
  const temp = parts[1]?.trim() || "";
  return { condition, temp };
}

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  // Force noon UTC to avoid timezone-offset day shifts
  const date = new Date(recommendation.date + "T12:00:00");
  const dayName = daysOfWeek[date.getDay()];
  const isViable = recommendation.is_viable;
  const confidence = Math.round(recommendation.confidence * 100);
  const { condition, temp } = parseWeatherMatch(recommendation.weather_match);
  const icon = weatherIcon(condition);

  return (
    <div className={`overflow-hidden rounded-3xl shadow-lg border ${isViable ? "border-slate-200" : "border-amber-300"}`}>

      {/* ── Gradient header ── */}
      <div className={`relative px-6 pt-6 pb-5 ${isViable ? "bg-gradient-to-br from-sky-500 to-cyan-400" : "bg-gradient-to-br from-amber-400 to-orange-400"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Day {recommendation.day}</p>
            <h3 className="mt-1 text-2xl font-bold text-white">{dayName}</h3>
            <p className="text-sm text-white/80">
              {date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-4xl leading-none">{icon}</span>
            {temp && (
              <span className="rounded-full bg-white/25 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                {temp}
              </span>
            )}
          </div>
        </div>

        {/* Weather condition pill */}
        <div className="mt-3 rounded-xl bg-white/20 px-3 py-2 backdrop-blur">
          <p className="text-sm font-medium text-white">{condition}</p>
        </div>

        {/* Viability badge */}
        <div className="mt-3">
          {isViable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-emerald-700">
              ✅ Outfit ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-amber-800">
              ⚠️ Wardrobe incomplete for this day
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-white p-6 space-y-5">

        {/* Outfit description */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Outfit Plan</p>
          <p className="text-sm leading-relaxed text-slate-700">{recommendation.outfit_description}</p>
        </div>

        {/* Clothing item chips */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Items</p>
          <div className="flex flex-wrap gap-2">
            {recommendation.clothing_items.map((item, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  item === "No suitable outfit found"
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "border border-sky-200 bg-sky-50 text-sky-700"
                }`}
              >
                {item !== "No suitable outfit found" && <span>👔</span>}
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Confidence</p>
            <p className="text-xs font-bold text-slate-600">{confidence}%</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                confidence >= 70 ? "bg-emerald-500" : confidence >= 45 ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Day warning */}
        {recommendation.day_warning && (
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <span className="mt-0.5 text-base">⚠️</span>
            <p className="text-sm text-amber-800">{recommendation.day_warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
