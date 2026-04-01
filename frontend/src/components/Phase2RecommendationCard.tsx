import type { Recommendation, UploadedClothing } from "../types/phase2";

interface RecommendationCardProps {
  recommendation: Recommendation;
  wardrobeItems: UploadedClothing[];
  recommendationCount?: number;
}

function toOrdinal(value: number): string {
  const v = Math.abs(value);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = v % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function canonicalCategory(value: string): string {
  const normalized = normalizeLabel(value);
  const aliases: Record<string, string> = {
    tee: "tshirt",
    tshirt: "tshirt",
    tshirts: "tshirt",
    shirt: "shirt",
    shirts: "shirt",
    blouse: "shirt",
    top: "shirt",
    tops: "shirt",
    jean: "jeans",
    jeans: "jeans",
    trouser: "pants",
    trousers: "pants",
    pant: "pants",
    pants: "pants",
    short: "shorts",
    shorts: "shorts",
    hoodie: "hoodie",
    hoodies: "hoodie",
    jacket: "jacket",
    jackets: "jacket",
    coat: "jacket",
    sweater: "sweater",
    sweaters: "sweater",
    jumper: "sweater",
    dress: "dress",
    dresses: "dress",
    skirt: "skirt",
    skirts: "skirt",
    shoe: "shoes",
    shoes: "shoes",
    oxford: "shoes",
    oxfordshoe: "shoes",
    loafer: "shoes",
    loafers: "shoes",
    sneaker: "shoes",
    sneakers: "shoes",
    boot: "shoes",
    boots: "shoes",
    sandal: "shoes",
    sandals: "shoes",
    heel: "shoes",
    heels: "shoes",
  };

  return aliases[normalized] || normalized;
}

function categoriesMatch(recommended: string, wardrobeCategory: string): boolean {
  const rec = canonicalCategory(recommended);
  const ward = canonicalCategory(wardrobeCategory);
  if (!rec || !ward) return false;
  return rec === ward || rec.includes(ward) || ward.includes(rec);
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

export default function RecommendationCard({
  recommendation,
  wardrobeItems,
  recommendationCount = 1,
}: RecommendationCardProps) {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  // Force noon UTC to avoid timezone-offset day shifts
  const date = new Date(recommendation.date + "T12:00:00");
  const dayName = daysOfWeek[date.getDay()];
  const isViable = recommendation.is_viable;
  const confidence = Math.round(recommendation.confidence * 100);
  const { condition, temp } = parseWeatherMatch(recommendation.weather_match);
  const icon = weatherIcon(condition);
  const recommendationSource = (recommendation.recommendation_source || "rule-based").toLowerCase();
  const usedWardrobeIds = new Set<string>();

  const itemVisuals = recommendation.clothing_items.map((label) => {
    const match =
      wardrobeItems.find((item) => {
        if (usedWardrobeIds.has(item.id)) return false;
        return categoriesMatch(label, item.analyzed?.category || "");
      }) || null;

    if (match) usedWardrobeIds.add(match.id);
    return { label, match };
  });

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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-cyan-700">
            {toOrdinal(recommendationCount)} recommendation
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
              recommendationSource === "ai"
                ? "bg-white/90 text-indigo-700"
                : "bg-white/90 text-slate-700"
            }`}
          >
            {recommendationSource === "ai" ? "AI Recommendation" : "Rule-based Recommendation"}
          </span>
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

        {/* Clothing item images */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Items</p>
          <div className="flex flex-wrap gap-3">
            {itemVisuals.map(({ label, match }, idx) => (
              <div
                key={`${label}-${idx}`}
                className={`w-24 overflow-hidden rounded-2xl border bg-slate-50 ${
                  match ? "border-slate-200" : "border-amber-200"
                }`}
              >
                {match ? (
                  <img
                    src={match.preview}
                    alt={label}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-slate-100 text-2xl">👕</div>
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-semibold text-slate-900">{label}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {match?.analyzed?.color || (label === "No suitable outfit found" ? "No match" : "Not found")}
                  </p>
                  {match?.analyzed?.gender && (
                    <span className="mt-1 inline-block rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                      {match.analyzed.gender}
                    </span>
                  )}
                </div>
              </div>
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
