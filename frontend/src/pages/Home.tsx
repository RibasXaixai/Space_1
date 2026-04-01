import { useState } from "react";
import UploadArea from "../components/UploadArea";
import LocationInput from "../components/LocationInput";
import EditableClothingItem from "../components/EditableClothingItem";
import Phase5WeatherForecastDisplay from "../components/Phase5WeatherForecastDisplay";
import Phase2RecommendationCard from "../components/Phase2RecommendationCard";
import Phase2WarningBanner from "../components/Phase2WarningBanner";
import Phase2FeedbackButtons from "../components/Phase2FeedbackButtons";
import {
  generateRecommendationsPhase2,
  getWeatherForecastPhase2,
  refreshRecommendationDayPhase2,
  uploadClothingPhase2,
} from "../services/phase2";
import type {
  UploadedClothing,
  ClothingAnalysis,
  Recommendation,
  WeatherForecast,
  WeatherForecastResponse,
  RecommendationsGenerateResponse,
} from "../types/phase2";

interface UploadedClothingFromAPI {
  id: string;
  file_path: string;
  analysis_source: "ai" | "fallback";
  category: string;
  color: string;
  style: string;
  warmth_level: string;
  weather_suitability: string;
  gender: "Male" | "Female" | "Unisex" | string;
  notes: string;
}

export default function Home() {
  type FeedbackValue = "like" | "dislike";
  const [uploadedClothing, setUploadedClothing] = useState<UploadedClothing[]>([]);
  const [location, setLocation] = useState<string>("");
  const [weather, setWeather] = useState<WeatherForecast[] | null>(null);
  const [weatherLocation, setWeatherLocation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [feedbackByDay, setFeedbackByDay] = useState<Record<number, FeedbackValue | null>>({});
  const [refreshingDay, setRefreshingDay] = useState<number | null>(null);
  const [uploadedFromAPI, setUploadedFromAPI] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const hasUploadedItems = uploadedClothing.length > 0;
  const hasWeather = weather !== null && weather.length > 0;
  const hasRecommendations = recommendations !== null;
  const canGenerate = hasUploadedItems && location.trim().length > 0 && hasWeather && !loading;
  const totalLikes = Object.values(feedbackByDay).filter((value) => value === "like").length;
  const totalDislikes = Object.values(feedbackByDay).filter((value) => value === "dislike").length;

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await uploadClothingPhase2(formData);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Upload failed.");
      }

      // Convert API response to UploadedClothing format
      const newClothing: UploadedClothing[] = data.items.map(
        (item: UploadedClothingFromAPI) => ({
          id: item.id,
          file: new File([], item.file_path), // Placeholder file object
          preview: `${apiUrl}/${item.file_path}`,
          analysis_source: item.analysis_source,
          analyzed: {
            category: item.category,
            color: item.color,
            style: item.style,
            warmth_level: item.warmth_level,
            weather_suitability: item.weather_suitability,
            gender: item.gender,
            notes: item.notes,
          },
        })
      );

      setUploadedClothing((prev) => [...prev, ...newClothing]);
      setUploadedFromAPI(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during upload."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClothing = (id: string) => {
    setUploadedClothing((prev) =>
      prev.filter((item) => {
        if (item.id === id) {
          URL.revokeObjectURL(item.preview);
        }
        return item.id !== id;
      })
    );
  };

  const handleAnalysisChange = (id: string, analysis: ClothingAnalysis) => {
    setUploadedClothing((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, analyzed: analysis } : item
      )
    );
  };

  const handleLocationChange = async (newLocation: string) => {
    setLocation(newLocation);
    setWeather(null);
    setWeatherLocation("");

    if (newLocation.trim().length > 2) {
      await fetchWeather(newLocation);
    }
  };

  const fetchWeather = async (loc: string) => {
    try {
      const response = await getWeatherForecastPhase2({
        location: loc,
        days: 5,
      });
      const data: WeatherForecastResponse = response.data;
      if (data.success && data.forecast) {
        setWeather(data.forecast);
        setWeatherLocation(data.location);
      }
    } catch (err) {
      console.error("Weather fetch error:", err);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (uploadedClothing.length === 0) {
      setError("Please upload at least one clothing item.");
      return;
    }

    if (!location.trim()) {
      setError("Please enter a location.");
      return;
    }

    if (!weather || weather.length === 0) {
      setError("Fetching weather forecast. Please try again in a moment.");
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations(null);
    setWarnings([]);
    setFeedbackByDay({});

    try {
      // Use already analyzed data and weather forecast
      const clothingAnalyses = uploadedClothing.map((item) => ({
        category: item.analyzed?.category || "",
        color: item.analyzed?.color || "",
        style: item.analyzed?.style || "",
        warmth_level: item.analyzed?.warmth_level || "",
        weather_suitability: item.analyzed?.weather_suitability || "",
        gender: item.analyzed?.gender || "Unisex",
        notes: item.analyzed?.notes || "",
      }));

      const recRes = await generateRecommendationsPhase2({
        clothing_data: clothingAnalyses,
        weather_forecast: weather,
        location,
      });
      const recData: RecommendationsGenerateResponse = recRes.data;

      setRecommendations(recData.recommendations);
      setWarnings(recData.warnings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = (day: number, value: FeedbackValue) => {
    setFeedbackByDay((prev) => ({
      ...prev,
      [day]: prev[day] === value ? null : value,
    }));
  };

  const handleRefreshDay = async (day: number) => {
    if (!weather || weather.length === 0) {
      setError("Weather forecast is missing. Generate forecast again first.");
      return;
    }

    setError(null);
    setRefreshingDay(day);

    try {
      const clothingAnalyses = uploadedClothing.map((item) => ({
        category: item.analyzed?.category || "",
        color: item.analyzed?.color || "",
        style: item.analyzed?.style || "",
        warmth_level: item.analyzed?.warmth_level || "",
        weather_suitability: item.analyzed?.weather_suitability || "",
        gender: item.analyzed?.gender || "Unisex",
        notes: item.analyzed?.notes || "",
      }));

      const response = await refreshRecommendationDayPhase2({
        day,
        clothing_data: clothingAnalyses,
        weather_forecast: weather,
        location,
      });

      const refreshed = response.data.recommendation;
      setRecommendations((prev) => {
        if (!prev) return prev;
        return prev.map((item) => (item.day === day ? refreshed : item));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh this day.");
    } finally {
      setRefreshingDay(null);
    }
  };

  return (
    <section className="space-y-8 py-6 sm:space-y-10 sm:py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
        <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative max-w-4xl">
          <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-5xl">
            Amazing Wardrobe Planner
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Build your next 5-day style mission: upload your wardrobe, lock your location, and unlock weather-aware outfit plans.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Step 1</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Upload clothing</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Step 2</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Set location + weather</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Step 3</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Generate and react</p>
            </div>
          </div>
        </div>
      </div>

      {/* Input Section */}
      {!hasRecommendations && (
        <div className="space-y-6 sm:space-y-8">
          {/* Upload Area */}
          <UploadArea onFilesSelected={handleFilesSelected} loading={loading} />

          {/* Uploaded Items Review */}
          {!hasUploadedItems && !loading && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-center sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Wardrobe Deck Empty</p>
              <p className="mt-2 text-sm text-slate-600">
                Add at least one item to begin your outfit challenge.
              </p>
            </div>
          )}

          {hasUploadedItems && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">
                Your Clothing Items ({uploadedClothing.length})
                </h2>
                {uploadedFromAPI && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Analyzed and ready
                  </span>
                )}
              </div>
              <p className="mb-4 text-sm text-slate-600">
                Review and edit the detected clothing properties below. Click "Edit" to adjust any details.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {uploadedClothing.map((item) => (
                  <EditableClothingItem
                    key={item.id}
                    item={item}
                    onAnalysisChange={handleAnalysisChange}
                    onRemove={handleRemoveClothing}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Location Input */}
          <LocationInput
            value={location}
            onChange={handleLocationChange}
          />

          {!hasWeather && location.trim().length > 2 && (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm font-semibold text-cyan-900">Fetching forecast...</p>
              <p className="mt-1 text-xs text-cyan-700">Hold tight while we prepare your weather intel.</p>
            </div>
          )}

          {/* Weather Forecast Display */}
          <Phase5WeatherForecastDisplay
            forecast={weather || []}
            location={weatherLocation}
            visible={weather !== null && weather.length > 0}
          />

          {/* Error Message */}
          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex gap-4">
                <div className="text-2xl">❌</div>
                <div>
                  <p className="font-semibold text-red-900">Something blocked your mission</p>
                  <p className="mt-1 text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center">
            <button
              onClick={handleGenerateRecommendations}
              disabled={!canGenerate}
              className="min-w-[260px] rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:from-sky-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating your style quest..." : "Generate My 5-Day Wardrobe Plan"}
            </button>
          </div>

          {!canGenerate && !loading && (
            <p className="text-center text-xs text-slate-500">
              Tip: upload at least one item, enter location, and wait for weather to unlock generation.
            </p>
          )}

          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
                  <div className="mt-6 h-10 rounded-2xl bg-slate-200" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {hasRecommendations && (
        <div className="space-y-6 sm:space-y-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-1 text-2xl font-bold text-slate-900">Your 5-Day Wardrobe Plan</h2>
            <p className="text-sm text-slate-600">📍 <span className="font-semibold">{location}</span></p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                👍 Likes: {totalLikes}
              </span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                👎 Dislikes: {totalDislikes}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                🗓 Days: {recommendations.length}
              </span>
            </div>
          </div>

          {/* Wardrobe strip */}
          {uploadedClothing.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                Your Wardrobe ({uploadedClothing.length} item{uploadedClothing.length !== 1 ? "s" : ""})
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {uploadedClothing.map((item) => (
                  <div
                    key={item.id}
                    className="flex-shrink-0 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <img
                      src={item.preview}
                      alt={item.analyzed?.category || "clothing"}
                      className="h-28 w-full object-cover"
                    />
                    <div className="p-2">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {item.analyzed?.category || "Unknown"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{item.analyzed?.color}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          <Phase2WarningBanner
            warnings={warnings}
            visible={warnings.length > 0}
          />

          {/* Recommendations — 2-col grid on md+ */}
          <div className="grid gap-6 md:grid-cols-2">
            {recommendations.map((rec) => (
              <div key={rec.day} className="flex flex-col gap-3">
                <Phase2RecommendationCard recommendation={rec} wardrobeItems={uploadedClothing} />
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleRefreshDay(rec.day)}
                    disabled={refreshingDay === rec.day}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshingDay === rec.day ? "Refreshing..." : "Refresh day"}
                  </button>
                </div>
                <Phase2FeedbackButtons
                  onLike={() => handleFeedback(rec.day, "like")}
                  onDislike={() => handleFeedback(rec.day, "dislike")}
                  selectedFeedback={feedbackByDay[rec.day] ?? null}
                />
              </div>
            ))}
          </div>

          {/* Reset Button */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                setRecommendations(null);
                setWarnings([]);
                setError(null);
                setFeedbackByDay({});
              }}
              className="rounded-full border border-slate-200 bg-slate-100 px-8 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              ← Start Over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
