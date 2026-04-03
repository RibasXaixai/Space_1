import { useEffect, useRef, useState } from "react";
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
  checkDuplicatesPhase2,
} from "../services/phase2";
import { validateImageFile } from "../utils/imageValidation";
import type {
  ClothingItemStatus,
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
  status?: ClothingItemStatus;
  review_reason?: string;
  review_issue?: string;
  reject_reason?: string;
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
  const BATCH_SIZE = 10;
  const REFRESH_COOLDOWN_MS = 15000;
  const [uploadedClothing, setUploadedClothing] = useState<UploadedClothing[]>([]);
  const [location, setLocation] = useState<string>("");
  const [weather, setWeather] = useState<WeatherForecast[] | null>(null);
  const [weatherLocation, setWeatherLocation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [feedbackByDay, setFeedbackByDay] = useState<Record<number, FeedbackValue | null>>({});
  const [recommendationCountByDay, setRecommendationCountByDay] = useState<Record<number, number>>({});
  const [refreshingDay, setRefreshingDay] = useState<number | null>(null);
  const [refreshCooldownUntilByDay, setRefreshCooldownUntilByDay] = useState<Record<number, number>>({});
  const [uploadProgress, setUploadProgress] = useState<{ uploaded: number; total: number }>({
    uploaded: 0,
    total: 0,
  });
  const [uploadedFromAPI, setUploadedFromAPI] = useState(false);
  const wasUploadingRef = useRef(false);
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const hasUploadedItems = uploadedClothing.length > 0;
  const isUploading = loading && uploadProgress.total > 0;
  const hasWeather = weather !== null && weather.length > 0;
  const hasRecommendations = recommendations !== null;
  const canGenerate = hasUploadedItems && location.trim().length > 0 && hasWeather && !loading;
  const totalLikes = Object.values(feedbackByDay).filter((value) => value === "like").length;
  const totalDislikes = Object.values(feedbackByDay).filter((value) => value === "dislike").length;

  const isNaCategory = (category: string | undefined): boolean => {
    const normalized = (category || "").trim().toLowerCase();
    return ["n/a", "na", "none", "unknown", "not available", "not_applicable"].includes(normalized);
  };

  const normalizeCategoryLabel = (category: string | undefined): string => {
    return isNaCategory(category) ? "Needs Review" : (category || "");
  };

  const resolveItemStatus = (item: UploadedClothingFromAPI): ClothingItemStatus => {
    if (isNaCategory(item.category)) {
      return "needs_review";
    }

    if (item.status === "analyzed" || item.status === "needs_review" || item.status === "rejected") {
      return item.status;
    }

    // Default fallback: if analysis fell back, require review before use.
    return item.analysis_source === "fallback" ? "needs_review" : "analyzed";
  };

  const playUploadFinishedSound = () => {
    try {
      const maybeAudioContext = (globalThis as any).AudioContext;
      if (!maybeAudioContext) return;

      const audioContext = new maybeAudioContext();
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);

      const note1 = audioContext.createOscillator();
      note1.type = "sine";
      note1.frequency.setValueAtTime(784, audioContext.currentTime);
      note1.connect(gainNode);

      const note2 = audioContext.createOscillator();
      note2.type = "sine";
      note2.frequency.setValueAtTime(1047, audioContext.currentTime + 0.1);
      note2.connect(gainNode);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

      note1.start(audioContext.currentTime);
      note1.stop(audioContext.currentTime + 0.1);
      note2.start(audioContext.currentTime + 0.1);
      note2.stop(audioContext.currentTime + 0.24);

      setTimeout(() => {
        audioContext.close().catch(() => {
          // Ignore close errors to keep UX smooth.
        });
      }, 350);
    } catch {
      // If browser blocks audio, continue silently.
    }
  };

  useEffect(() => {
    if (isUploading) {
      wasUploadingRef.current = true;
      return;
    }

    if (wasUploadingRef.current && uploadedFromAPI) {
      playUploadFinishedSound();
    }

    wasUploadingRef.current = false;
  }, [isUploading, uploadedFromAPI]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);
    setUploadedFromAPI(false);
    setUploadProgress({ uploaded: 0, total: files.length });

    const allNewItems: UploadedClothing[] = [];

    // Step 1: frontend validation — reject invalid files immediately without uploading
    const validFiles: File[] = [];
    const fileWarnings: Record<string, string> = {};  // Track validation warnings by fileName
    const rejectedItems: UploadedClothing[] = [];

    for (const file of files) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        const preview = URL.createObjectURL(file);
        rejectedItems.push({
          id: crypto.randomUUID(),
          file,
          preview,
          status: "rejected",
          reject_reason: validation.reject_reason,
        });
      } else {
        validFiles.push(file);
        if (validation.warning) {
          fileWarnings[file.name] = validation.warning;
        }
      }
    }

    // Show rejected items immediately
    if (rejectedItems.length > 0) {
      allNewItems.push(...rejectedItems);
      setUploadedClothing((prev) => [...prev, ...rejectedItems]);
    }

    setUploadProgress({ uploaded: 0, total: validFiles.length });

    try {
      let processed = 0;

      for (let start = 0; start < validFiles.length; start += BATCH_SIZE) {
        const batch = validFiles.slice(start, start + BATCH_SIZE);
        const formData = new FormData();
        batch.forEach((file) => {
          formData.append("files", file);
        });

        const response = await uploadClothingPhase2(formData);
        const data = response.data;

        if (!data.success) {
          throw new Error(data.message || "Upload failed.");
        }

        const newClothing: UploadedClothing[] = data.items.map(
          (item: UploadedClothingFromAPI) => ({
            id: item.id,
            file: new File([], item.file_path),
            preview: `${apiUrl}/${item.file_path}`,
            file_path: item.file_path,
            analysis_source: item.analysis_source,
            status: resolveItemStatus(item),
            review_reason: item.review_reason,
            review_issue: item.review_issue,
            reject_reason: item.reject_reason,
            validation_warning: fileWarnings[item.file_path.split('/').pop() || ''] || undefined,
            analyzed: {
              category: normalizeCategoryLabel(item.category),
              color: item.color,
              style: item.style,
              warmth_level: item.warmth_level,
              weather_suitability: item.weather_suitability,
              gender: item.gender,
              notes: item.notes,
            },
          })
        );

        allNewItems.push(...newClothing);
        setUploadedClothing((prev) => [...prev, ...newClothing]);

        processed = Math.min(validFiles.length, processed + batch.length);
        setUploadProgress({ uploaded: processed, total: validFiles.length });
      }

      setUploadedFromAPI(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during upload."
      );
    } finally {
      setLoading(false);
      setUploadProgress({ uploaded: 0, total: 0 });
    }

    // Background duplicate check — runs after items are already shown
    // Include existing items so new uploads are compared against the full wardrobe
    if (allNewItems.length > 0) {
      try {
        const newItemIds = new Set(allNewItems.map((i) => i.id));

        // Existing items (before this upload) + new items — backend checks all against each other
        const existingForCheck = uploadedClothing
          .filter((item) => item.file_path)
          .map((item) => ({ id: item.id, file_path: item.file_path! }));

        const newForCheck = allNewItems
          .filter((item) => item.file_path)
          .map((item) => ({ id: item.id, file_path: item.file_path! }));

        const allItemsToCheck = [...existingForCheck, ...newForCheck];

        const dupResponse = await checkDuplicatesPhase2(allItemsToCheck);
        const dupResults: { id: string; is_exact_duplicate: boolean; is_similar_duplicate: boolean }[] =
          dupResponse.data?.results ?? [];

        // Only apply duplicate flags to the newly uploaded items
        setUploadedClothing((prev) =>
          prev.map((item) => {
            if (!newItemIds.has(item.id)) return item;
            const result = dupResults.find((r) => r.id === item.id);
            if (!result) return item;
            return {
              ...item,
              is_exact_duplicate: result.is_exact_duplicate,
              is_similar_duplicate: result.is_similar_duplicate,
            };
          })
        );
      } catch {
        // Duplicate check failing silently — badges simply won't show
      }
    }
  };

  const handleRemoveClothing = (id: string) => {
    setUploadedClothing((prev) =>
      prev.filter((item) => {
        if (item.id === id && item.preview.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview);
        }
        return item.id !== id;
      })
    );
  };

  const handleReplaceClothing = (id: string, file: File) => {
    // Remove the old rejected item, then re-upload the new file
    setUploadedClothing((prev) =>
      prev.filter((item) => {
        if (item.id === id && item.preview.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview);
        }
        return item.id !== id;
      })
    );
    handleFilesSelected([file]);
  };

  const handleClearAllClothing = () => {
    setUploadedClothing((prev) => {
      prev.forEach((item) => {
        if (item.preview.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview);
        }
      });
      return [];
    });

    setUploadedFromAPI(false);
    setRecommendations(null);
    setWarnings([]);
    setFeedbackByDay({});
    setRecommendationCountByDay({});
    setError(null);
  };

  const handleAnalysisChange = (id: string, analysis: ClothingAnalysis) => {
    setUploadedClothing((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              analyzed: {
                ...analysis,
                category: normalizeCategoryLabel(analysis.category),
              },
              status: isNaCategory(analysis.category) ? "needs_review" : "analyzed",
            }
          : item
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

    const TOPS = ["T-Shirt", "Shirt", "Blouse", "Sweater", "Hoodie", "Jacket", "Coat"];
    const BOTTOMS = ["Jeans", "Pants", "Shorts", "Skirt"];

    const usableItems = uploadedClothing.filter(
      (item) => item.status === "analyzed" && !item.is_exact_duplicate && !item.is_similar_duplicate
    );
    if (usableItems.length === 0) {
      setError("Please review at least one item before generating recommendations.");
      return;
    }

    const hasTops = usableItems.some(
      (item) => TOPS.includes(item.analyzed?.category || "") || item.analyzed?.category === "Dress"
    );
    const hasBottoms = usableItems.some(
      (item) => BOTTOMS.includes(item.analyzed?.category || "") || item.analyzed?.category === "Dress"
    );
    if (!hasTops || !hasBottoms) {
      setError(
        "Your wardrobe needs at least 1 top and 1 bottom (or a dress) to generate outfit recommendations. Please add more items."
      );
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
    setRecommendationCountByDay({});

    try {
      // Use already analyzed data and weather forecast
      const clothingAnalyses = usableItems.map((item) => ({
        item_id: item.id,
        status: item.status || "analyzed",
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
      setRecommendationCountByDay(
        (recData.recommendations || []).reduce<Record<number, number>>((acc, rec) => {
          acc[rec.day] = 1;
          return acc;
        }, {})
      );
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

    const usableItems = uploadedClothing.filter(
      (item) => item.status === "analyzed" && !item.is_exact_duplicate && !item.is_similar_duplicate
    );
    if (usableItems.length === 0) {
      setError("Please review at least one item before refreshing recommendations.");
      return;
    }

    const cooldownUntil = refreshCooldownUntilByDay[day] ?? 0;
    const now = Date.now();
    if (cooldownUntil > now) {
      const waitSeconds = Math.ceil((cooldownUntil - now) / 1000);
      setError(`Please wait ${waitSeconds}s before refreshing Day ${day} again.`);
      return;
    }

    setFeedbackByDay((prev) => ({
      ...prev,
      [day]: null,
    }));

    setError(null);
    setRefreshingDay(day);

    try {
      const clothingAnalyses = usableItems.map((item) => ({
        item_id: item.id,
        status: item.status || "analyzed",
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
      setRecommendationCountByDay((prev) => ({
        ...prev,
        [day]: (prev[day] ?? 1) + 1,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh this day.");
    } finally {
      const cooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
      setRefreshCooldownUntilByDay((prev) => ({ ...prev, [day]: cooldownUntil }));
      window.setTimeout(() => {
        setRefreshCooldownUntilByDay((prev) => {
          const current = prev[day];
          if (!current || current <= Date.now()) {
            const next = { ...prev };
            delete next[day];
            return next;
          }
          return prev;
        });
      }, REFRESH_COOLDOWN_MS + 100);

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
          <UploadArea
            onFilesSelected={handleFilesSelected}
            loading={loading}
            uploadedCount={uploadProgress.uploaded}
            totalCount={uploadProgress.total}
          />

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
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">
                Your Clothing Items ({uploadedClothing.length})
                </h2>
                <button
                  type="button"
                  onClick={handleClearAllClothing}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1 self-end rounded-xl border border-rose-300 bg-rose-100 px-4 py-2 text-sm text-rose-700 shadow-sm transition hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🗑 Clear all
                </button>
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
                    onReplace={handleReplaceClothing}
                    disabled={isUploading}
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
                <Phase2RecommendationCard
                  recommendation={rec}
                  wardrobeItems={uploadedClothing}
                  recommendationCount={recommendationCountByDay[rec.day] ?? 1}
                />
                <Phase2FeedbackButtons
                  onLike={() => handleFeedback(rec.day, "like")}
                  onDislike={() => handleFeedback(rec.day, "dislike")}
                  selectedFeedback={feedbackByDay[rec.day] ?? null}
                  disabled={isUploading}
                />
                {(feedbackByDay[rec.day] === "dislike" || refreshingDay === rec.day) && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleRefreshDay(rec.day)}
                      disabled={
                        isUploading ||
                        refreshingDay === rec.day ||
                        (refreshCooldownUntilByDay[rec.day] ?? 0) > Date.now()
                      }
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {refreshingDay === rec.day
                        ? "Thinking..."
                        : (refreshCooldownUntilByDay[rec.day] ?? 0) > Date.now()
                          ? `Cooldown (${Math.ceil(((refreshCooldownUntilByDay[rec.day] ?? 0) - Date.now()) / 1000)}s)`
                          : "Refresh day"}
                    </button>
                  </div>
                )}
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
                setRecommendationCountByDay({});
              }}
              disabled={isUploading}
              className="rounded-full border border-slate-200 bg-slate-100 px-8 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Start Over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
