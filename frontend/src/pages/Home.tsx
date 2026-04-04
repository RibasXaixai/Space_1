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
  refreshRecommendationWeekPhase2,
  uploadClothingPhase2,
  checkDuplicatesPhase2,
  sendPlanEmailPhase2,
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
  const MAX_STYLE_RESET_TRIES = 3;
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
  const [isRefreshingWeek, setIsRefreshingWeek] = useState(false);
  const [showRefreshWeekModal, setShowRefreshWeekModal] = useState(false);
  const [styleResetTriggerCount, setStyleResetTriggerCount] = useState(0);
  const [refreshCooldownUntilByDay, setRefreshCooldownUntilByDay] = useState<Record<number, number>>({});
  const [uploadProgress, setUploadProgress] = useState<{ uploaded: number; total: number }>({
    uploaded: 0,
    total: 0,
  });
  const [uploadedFromAPI, setUploadedFromAPI] = useState(false);
  const [showGameOverFlash, setShowGameOverFlash] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [showCelebrationFlash, setShowCelebrationFlash] = useState(false);
  const [planEmail, setPlanEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendState, setEmailSendState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const wasUploadingRef = useRef(false);
  const startOverSoundPlayedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gameOverFlashTimeoutRef = useRef<number | null>(null);
  const celebrationFlashTimeoutRef = useRef<number | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const hasUploadedItems = uploadedClothing.length > 0;
  const isUploading = loading && uploadProgress.total > 0;
  const hasWeather = weather !== null && weather.length > 0;
  const hasRecommendations = recommendations !== null;
  const canGenerate = hasUploadedItems && location.trim().length > 0 && hasWeather && !loading;
  const totalLikes = Object.values(feedbackByDay).filter((value) => value === "like").length;
  const totalDislikes = Object.values(feedbackByDay).filter((value) => value === "dislike").length;
  const showStartOverOnlyInModal = styleResetTriggerCount >= MAX_STYLE_RESET_TRIES;
  const remainingStyleResetTries = Math.max(0, MAX_STYLE_RESET_TRIES - styleResetTriggerCount);

  const isNaCategory = (category: string | undefined): boolean => {
    const normalized = (category || "").trim().toLowerCase();
    return ["n/a", "na", "none", "unknown", "not available", "not_applicable"].includes(normalized);
  };

  const sanitizeEmailInput = (value: string): string => {
    return value
      .toLowerCase()
      .replace(/[\u0000-\u001F\u007F\s<>\"'`]/g, "")
      .slice(0, 254);
  };

  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

  const buildClothingAnalyses = (items: UploadedClothing[]) =>
    items.map((item) => ({
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

  const getWardrobeTypeLabel = (item: UploadedClothing): string => {
    const normalized = (item.analyzed?.category || "").trim().toLowerCase();

    if (item.status === "rejected") return "Rejected images";
    if (["t-shirt", "shirt", "blouse", "sweater", "hoodie", "top", "tee", "tank"].some((token) => normalized.includes(token))) return "Tops";
    if (["jeans", "pants", "trouser", "shorts", "skirt", "leggings"].some((token) => normalized.includes(token))) return "Bottoms";
    if (normalized.includes("dress")) return "Dresses";
    if (["jacket", "coat", "cardigan", "blazer", "parka", "raincoat"].some((token) => normalized.includes(token))) return "Outerwear";
    if (["shoe", "sneaker", "boot", "sandal", "loafer", "heel"].some((token) => normalized.includes(token))) return "Shoes";
    return "Other";
  };

  const typeOrder = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Other", "Rejected images"];
  const groupedWardrobeSections = [
    {
      key: "analyzed" as const,
      title: "Ready for outfits",
      description: "These items are fully analyzed and ready for recommendations.",
      containerClass: "border-emerald-200 bg-emerald-50/50",
      badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-800",
      items: uploadedClothing.filter((item) => item.status === "analyzed"),
    },
    {
      key: "needs_review" as const,
      title: "Needs review",
      description: "These items need your confirmation before they can be used.",
      containerClass: "border-amber-200 bg-amber-50/50",
      badgeClass: "border-amber-200 bg-amber-100 text-amber-800",
      items: uploadedClothing.filter((item) => item.status === "needs_review"),
    },
    {
      key: "rejected" as const,
      title: "Rejected images",
      description: "These uploads were blocked or could not be used as clothing items.",
      containerClass: "border-rose-200 bg-rose-50/50",
      badgeClass: "border-rose-200 bg-rose-100 text-rose-800",
      items: uploadedClothing.filter((item) => item.status === "rejected"),
    },
  ]
    .map((section) => ({
      ...section,
      groups: typeOrder
        .map((label) => ({
          label,
          items: section.items.filter((item) => getWardrobeTypeLabel(item) === label),
        }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((section) => section.items.length > 0);

  const getAudioContext = () => {
    const maybeWindow = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = maybeWindow.AudioContext || maybeWindow.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  };

  const playUploadFinishedSound = () => {
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;

      void audioContext.resume().then(() => {
        const now = audioContext.currentTime;
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        const note1 = audioContext.createOscillator();
        note1.type = "sine";
        note1.frequency.setValueAtTime(784, now);
        note1.connect(gainNode);

        const note2 = audioContext.createOscillator();
        note2.type = "sine";
        note2.frequency.setValueAtTime(1047, now + 0.1);
        note2.connect(gainNode);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

        note1.start(now);
        note1.stop(now + 0.1);
        note2.start(now + 0.1);
        note2.stop(now + 0.24);
      }).catch(() => {
        // Ignore resume errors to keep UX smooth.
      });
    } catch {
      // If browser blocks audio, continue silently.
    }
  };

  const playStartOverGameOverSound = () => {
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;

      void audioContext.resume().then(() => {
        const now = audioContext.currentTime + 0.02;
        const masterGain = audioContext.createGain();
        const compressor = audioContext.createDynamicsCompressor();

        compressor.threshold.setValueAtTime(-24, now);
        compressor.knee.setValueAtTime(20, now);
        compressor.ratio.setValueAtTime(14, now);
        compressor.attack.setValueAtTime(0.003, now);
        compressor.release.setValueAtTime(0.2, now);

        masterGain.connect(compressor);
        compressor.connect(audioContext.destination);

        const notes = [880, 783.99, 659.25, 523.25, 392, 261.63];
        const noteDuration = 0.24;
        const spacing = 0.32;

        notes.forEach((frequency, index) => {
          const startTime = now + index * spacing;

          [1, 0.5].forEach((multiplier, layerIndex) => {
            const oscillator = audioContext.createOscillator();
            const noteGain = audioContext.createGain();

            oscillator.type = layerIndex === 0 ? "square" : "sawtooth";
            oscillator.frequency.setValueAtTime(frequency * multiplier, startTime);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(110, frequency * multiplier * 0.92), startTime + noteDuration);

            noteGain.gain.setValueAtTime(0.0001, startTime);
            noteGain.gain.exponentialRampToValueAtTime(layerIndex === 0 ? 0.14 : 0.07, startTime + 0.015);
            noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

            oscillator.connect(noteGain);
            noteGain.connect(masterGain);
            oscillator.start(startTime);
            oscillator.stop(startTime + noteDuration);
          });
        });

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);
      }).catch(() => {
        // Ignore resume errors to keep UX smooth.
      });
    } catch {
      // If browser blocks audio, continue silently.
    }
  };

  const triggerGameOverFeedback = () => {
    playStartOverGameOverSound();
    setShowGameOverFlash(true);

    if (gameOverFlashTimeoutRef.current) {
      window.clearTimeout(gameOverFlashTimeoutRef.current);
    }

    gameOverFlashTimeoutRef.current = window.setTimeout(() => {
      setShowGameOverFlash(false);
      gameOverFlashTimeoutRef.current = null;
    }, 650);
  };

  const playCelebrationSound = () => {
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;

      void audioContext.resume().then(() => {
        const now = audioContext.currentTime + 0.02;
        const masterGain = audioContext.createGain();
        const compressor = audioContext.createDynamicsCompressor();

        compressor.threshold.setValueAtTime(-18, now);
        compressor.knee.setValueAtTime(18, now);
        compressor.ratio.setValueAtTime(10, now);
        compressor.attack.setValueAtTime(0.002, now);
        compressor.release.setValueAtTime(0.18, now);

        masterGain.connect(compressor);
        compressor.connect(audioContext.destination);

        const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        melody.forEach((frequency, index) => {
          const startTime = now + index * 0.16;
          const oscillator = audioContext.createOscillator();
          const harmony = audioContext.createOscillator();
          const noteGain = audioContext.createGain();

          oscillator.type = "triangle";
          harmony.type = "square";
          oscillator.frequency.setValueAtTime(frequency, startTime);
          harmony.frequency.setValueAtTime(frequency * 1.5, startTime);

          noteGain.gain.setValueAtTime(0.0001, startTime);
          noteGain.gain.exponentialRampToValueAtTime(0.16, startTime + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

          oscillator.connect(noteGain);
          harmony.connect(noteGain);
          noteGain.connect(masterGain);
          oscillator.start(startTime);
          harmony.start(startTime);
          oscillator.stop(startTime + 0.2);
          harmony.stop(startTime + 0.2);
        });

        [0.18, 0.42, 0.74].forEach((offset) => {
          const startTime = now + offset;
          const oscillator = audioContext.createOscillator();
          const burstGain = audioContext.createGain();

          oscillator.type = "sawtooth";
          oscillator.frequency.setValueAtTime(1400, startTime);
          oscillator.frequency.exponentialRampToValueAtTime(220, startTime + 0.12);

          burstGain.gain.setValueAtTime(0.0001, startTime);
          burstGain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.01);
          burstGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.13);

          oscillator.connect(burstGain);
          burstGain.connect(masterGain);
          oscillator.start(startTime);
          oscillator.stop(startTime + 0.13);
        });

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.exponentialRampToValueAtTime(0.24, now + 0.04);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
      }).catch(() => {
        // Ignore resume errors to keep UX smooth.
      });
    } catch {
      // If browser blocks audio, continue silently.
    }
  };

  const triggerCelebrationFeedback = () => {
    playCelebrationSound();
    setPlanEmail("");
    setEmailSendState(null);
    setIsSendingEmail(false);
    setShowCelebrationModal(true);
    setShowCelebrationFlash(true);

    if (celebrationFlashTimeoutRef.current) {
      window.clearTimeout(celebrationFlashTimeoutRef.current);
    }

    celebrationFlashTimeoutRef.current = window.setTimeout(() => {
      setShowCelebrationFlash(false);
      celebrationFlashTimeoutRef.current = null;
    }, 900);
  };

  const handleCloseCelebrationModal = () => {
    setShowCelebrationModal(false);
    setShowCelebrationFlash(false);
    setEmailSendState(null);
    setPlanEmail("");
    setIsSendingEmail(false);
  };

  const handleCelebrationAction = async () => {
    if (emailSendState?.type === "success") {
      handleCloseCelebrationModal();
      return;
    }

    const trimmedEmail = sanitizeEmailInput(planEmail);

    if (!trimmedEmail) {
      handleCloseCelebrationModal();
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailSendState({
        type: "error",
        message: "Please enter a valid email address before continuing.",
      });
      return;
    }

    if (!recommendations || recommendations.length === 0 || !weather || weather.length === 0) {
      setEmailSendState({
        type: "error",
        message: "Your plan is not ready to email yet. Generate the 5-day plan first.",
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailSendState(null);

    try {
      await sendPlanEmailPhase2({
        email: trimmedEmail,
        location,
        weather_forecast: weather,
        recommendations,
        warnings,
        wardrobe_items: uploadedClothing
          .filter((item) => item.status === "analyzed")
          .map((item) => ({
            id: item.id,
            file_path: item.file_path,
            category: item.analyzed?.category || "Unknown",
            color: item.analyzed?.color || "Unknown",
            gender: item.analyzed?.gender || "Unisex",
          })),
      });

      setEmailSendState({
        type: "success",
        message: `Your 5-day wardrobe plan was sent to ${trimmedEmail}.`,
      });
    } catch (err) {
      const maybeError = err as { response?: { data?: { detail?: string } } };
      setEmailSendState({
        type: "error",
        message:
          maybeError.response?.data?.detail ||
          (err instanceof Error ? err.message : "We could not send the email right now. Please try again."),
      });
    } finally {
      setIsSendingEmail(false);
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

  useEffect(() => {
    const shouldPlayGameOver = showRefreshWeekModal && showStartOverOnlyInModal && !isRefreshingWeek;

    if (shouldPlayGameOver && !startOverSoundPlayedRef.current) {
      triggerGameOverFeedback();
      startOverSoundPlayedRef.current = true;
      return;
    }

    if (!shouldPlayGameOver) {
      startOverSoundPlayedRef.current = false;
      setShowGameOverFlash(false);
    }
  }, [showRefreshWeekModal, showStartOverOnlyInModal, isRefreshingWeek]);

  useEffect(() => {
    return () => {
      if (gameOverFlashTimeoutRef.current) {
        window.clearTimeout(gameOverFlashTimeoutRef.current);
      }
      if (celebrationFlashTimeoutRef.current) {
        window.clearTimeout(celebrationFlashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasRecommendations) return;

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [hasRecommendations]);

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
    setStyleResetTriggerCount(0);
    setShowRefreshWeekModal(false);
    setShowCelebrationModal(false);
    setShowCelebrationFlash(false);
    setPlanEmail("");
    setEmailSendState(null);
    setIsSendingEmail(false);
    setError(null);
  };

  const handleStartOver = () => {
    setRecommendations(null);
    setWarnings([]);
    setError(null);
    setFeedbackByDay({});
    setRecommendationCountByDay({});
    setShowRefreshWeekModal(false);
    setShowCelebrationModal(false);
    setShowCelebrationFlash(false);
    setPlanEmail("");
    setEmailSendState(null);
    setIsSendingEmail(false);
    setIsRefreshingWeek(false);
    setStyleResetTriggerCount(0);
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

    const TOPS = ["T-Shirt", "Shirt", "Blouse", "Sweater", "Hoodie", "Top", "Tank"];
    const BOTTOMS = ["Jeans", "Pants", "Shorts", "Skirt", "Trousers", "Leggings"];

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
    setShowCelebrationModal(false);
    setShowCelebrationFlash(false);
    setEmailSendState(null);
    setIsSendingEmail(false);

    try {
      // Use already analyzed data and weather forecast
      const clothingAnalyses = buildClothingAnalyses(usableItems);

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
    const currentValue = feedbackByDay[day] ?? null;
    const nextValue = currentValue === value ? null : value;
    const nextFeedback = {
      ...feedbackByDay,
      [day]: nextValue,
    };

    setFeedbackByDay(nextFeedback);

    const dislikeCount = Object.values(nextFeedback).filter((item) => item === "dislike").length;
    if (value === "dislike" && nextValue === "dislike" && dislikeCount >= 5 && !showRefreshWeekModal) {
      const nextTriggerCount = styleResetTriggerCount + 1;
      if (nextTriggerCount >= MAX_STYLE_RESET_TRIES) {
        triggerGameOverFeedback();
        startOverSoundPlayedRef.current = true;
      }
      setStyleResetTriggerCount((count) => count + 1);
      setShowRefreshWeekModal(true);
    }

    const likeCount = Object.values(nextFeedback).filter((item) => item === "like").length;
    if (
      value === "like" &&
      nextValue === "like" &&
      recommendations &&
      recommendations.length > 0 &&
      likeCount === recommendations.length
    ) {
      triggerCelebrationFeedback();
    }
  };

  const handleCloseRefreshWeekModal = () => {
    setShowRefreshWeekModal(false);
    setFeedbackByDay((prev) =>
      Object.entries(prev).reduce<Record<number, FeedbackValue | null>>((acc, [day, value]) => {
        acc[Number(day)] = value === "dislike" ? null : value;
        return acc;
      }, {})
    );
  };

  const handleRefreshWeek = async () => {
    if (!weather || weather.length === 0) {
      setError("Weather forecast is missing. Generate forecast again first.");
      return;
    }

    const usableItems = uploadedClothing.filter(
      (item) => item.status === "analyzed" && !item.is_exact_duplicate && !item.is_similar_duplicate
    );
    if (usableItems.length === 0 || !recommendations) {
      setError("Please review at least one item before refreshing the full week.");
      return;
    }

    setIsRefreshingWeek(true);
    setError(null);

    try {
      const clothingAnalyses = buildClothingAnalyses(usableItems);
      const response = await refreshRecommendationWeekPhase2({
        clothing_data: clothingAnalyses,
        weather_forecast: weather,
        location,
        current_recommendations: recommendations,
      });

      const refreshed = response.data;
      setRecommendations(refreshed.recommendations);
      setWarnings(refreshed.warnings || []);
      setFeedbackByDay({});
      setRecommendationCountByDay((prev) =>
        (refreshed.recommendations || []).reduce<Record<number, number>>((acc, rec) => {
          acc[rec.day] = (prev[rec.day] ?? 1) + 1;
          return acc;
        }, {})
      );
      setShowRefreshWeekModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh the full week.");
    } finally {
      setIsRefreshingWeek(false);
    }
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
      const clothingAnalyses = buildClothingAnalyses(usableItems);

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
      {!hasRecommendations && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
          <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-cyan-200/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="relative max-w-4xl">
            <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-5xl">
              Amazing Wardrobe Planner
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Build your next 5-day style trip: upload your wardrobe, set your location, and unlock weather-aware outfit plans.
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
      )}

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
                Review and edit the detected clothing properties below. Items are grouped by status and clothing type, and every valid item now has a wardrobe ID.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {groupedWardrobeSections.map((section) => (
                  <span
                    key={section.key}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${section.badgeClass}`}
                  >
                    {section.title}: {section.items.length}
                  </span>
                ))}
              </div>
              <div className="space-y-6">
                {groupedWardrobeSections.map((section) => (
                  <div key={section.key} className={`rounded-3xl border p-4 sm:p-5 ${section.containerClass}`}>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">{section.description}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${section.badgeClass}`}>
                        {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="space-y-5">
                      {section.groups.map((group) => (
                        <div key={`${section.key}-${group.label}`}>
                          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                            {group.label} ({group.items.length})
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {group.items.map((item) => (
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
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location Input */}
          <LocationInput
            value={location}
            onChange={handleLocationChange}
            disabled={isUploading}
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
                  <p className="font-semibold text-red-900">Something blocked your trip</p>
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
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl sm:p-8">
            <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-cyan-200/50 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-fuchsia-200/40 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">Style trip ready</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Your 5-Day Wardrobe Plan</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
                  Built from your wardrobe and the latest forecast for <span className="font-semibold text-slate-900">{location}</span>. Review each day, keep the looks you love, and refresh anything you want to swap.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
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

            <div className="relative mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200/80 pt-4">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                📍 {location}
              </span>
              {weatherLocation && weatherLocation !== location && (
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                  Forecast source: {weatherLocation}
                </span>
              )}
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
                  disabled={isUploading || isRefreshingWeek}
                />
                {(feedbackByDay[rec.day] === "dislike" || refreshingDay === rec.day) && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleRefreshDay(rec.day)}
                      disabled={
                        isUploading ||
                        isRefreshingWeek ||
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
              onClick={handleStartOver}
              disabled={isUploading}
              className="rounded-full border border-slate-200 bg-slate-100 px-8 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Start Over
            </button>
          </div>

        </div>
      )}

      {showCelebrationModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm transition-all duration-300 ${showCelebrationFlash ? "bg-amber-950/70" : "bg-slate-950/60"}`}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[8%] top-[12%] text-4xl animate-bounce" style={{ animationDelay: "0ms" }}>🎆</div>
            <div className="absolute right-[10%] top-[14%] text-4xl animate-bounce" style={{ animationDelay: "150ms" }}>🎉</div>
            <div className="absolute left-[14%] bottom-[18%] text-3xl animate-pulse" style={{ animationDelay: "120ms" }}>✨</div>
            <div className="absolute right-[16%] bottom-[16%] text-3xl animate-pulse" style={{ animationDelay: "260ms" }}>🎇</div>
            <div className="absolute left-1/4 top-1/4 h-24 w-24 rounded-full bg-fuchsia-400/30 animate-ping" />
            <div className="absolute right-1/4 top-1/3 h-20 w-20 rounded-full bg-amber-300/30 animate-ping" style={{ animationDelay: "220ms" }} />
            <div className="absolute bottom-1/4 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-sky-300/25 animate-ping" style={{ animationDelay: "320ms" }} />
          </div>

          <div className={`relative w-full max-w-xl overflow-hidden rounded-3xl border shadow-2xl transition-all duration-300 ${showCelebrationFlash ? "scale-[1.03] border-amber-300 bg-amber-50 ring-4 ring-amber-300/80" : "border-fuchsia-200 bg-white"}`}>
            <div className="bg-gradient-to-r from-fuchsia-600 via-amber-400 to-sky-500 px-6 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Style celebration</p>
                  <h3 className="mt-1 text-xl font-bold">Ready to Slay the Week</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseCelebrationModal}
                  className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white hover:bg-white/25"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6 text-center">
              <div className="relative flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-fuchsia-50 to-sky-100">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_55%)]" />
                <div className="absolute left-6 top-5 text-3xl animate-bounce">🎉</div>
                <div className="absolute right-6 top-6 text-3xl animate-bounce" style={{ animationDelay: "150ms" }}>✨</div>
                <div className="absolute bottom-5 left-8 text-3xl animate-pulse">🎆</div>
                <div className="absolute bottom-6 right-8 text-3xl animate-pulse" style={{ animationDelay: "180ms" }}>👏</div>
                <span className="relative text-7xl drop-shadow-sm animate-bounce">😎</span>
              </div>

              <div className="space-y-2">
                <p className="text-2xl font-black text-slate-900">Ready to Slay the Week</p>
                <p className="text-sm text-slate-600">
                  All 5 recommendation days got a <span className="font-semibold text-emerald-700">Like</span>. Your outfit plan is locked in and ready to shine.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800">Trip status</p>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-900">
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">👍 {recommendations?.length ?? 5}/{recommendations?.length ?? 5} likes</span>
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">✨ Week approved</span>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-left shadow-sm">
                <label htmlFor="celebration-email" className="text-sm font-semibold text-slate-900">
                  Email this 5-day plan
                </label>
                <p className="mt-1 text-xs text-slate-600">
                  Optional: enter a valid email and click <span className="font-semibold">Let’s go</span> to receive the full wardrobe plan, location, weather, and notes in your inbox.
                </p>
                <div className="mt-3">
                  <input
                    id="celebration-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={254}
                    value={planEmail}
                    onChange={(event) => {
                      setPlanEmail(sanitizeEmailInput(event.target.value));
                      if (emailSendState) {
                        setEmailSendState(null);
                      }
                    }}
                    disabled={isSendingEmail || emailSendState?.type === "success"}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                {emailSendState && (
                  <p
                    className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${
                      emailSendState.type === "success"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {emailSendState.message}
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCelebrationAction}
                  disabled={isSendingEmail}
                  className="rounded-full bg-gradient-to-r from-fuchsia-600 via-amber-500 to-sky-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingEmail ? "Sending..." : emailSendState?.type === "success" ? "Close" : "Let’s go ✨"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRefreshWeekModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm transition-all duration-300 ${showGameOverFlash && showStartOverOnlyInModal ? "bg-rose-950/75" : "bg-slate-950/60"}`}>
          {showGameOverFlash && showStartOverOnlyInModal && (
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-rose-300/35" />
          )}
          <div className={`relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl transition-all duration-300 ${showGameOverFlash && showStartOverOnlyInModal ? "scale-[1.03] border-rose-300 bg-rose-50 ring-4 ring-rose-300/80" : "border-sky-200 bg-white"}`}>
            <div className="bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Style reset</p>
                  <h3 className="mt-1 text-xl font-bold">Your wardrobe wants another shot</h3>
                </div>
                {!showStartOverOnlyInModal && (
                  <button
                    type="button"
                    onClick={handleCloseRefreshWeekModal}
                    disabled={isRefreshingWeek}
                    className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 p-6">
              {isRefreshingWeek ? (
                <div className="space-y-4">
                  <div className="flex h-48 w-full flex-col items-center justify-center rounded-2xl bg-slate-100 px-4 text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
                    <p className="mt-4 text-base font-semibold text-slate-900">Refreshing your week...</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Finding a fresh set of outfit ideas for all 5 days.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-slate-100 text-6xl font-black text-slate-500">
                    🤔
                  </div>
                  <div className="space-y-2 text-center">
                    <p className="text-base font-semibold text-slate-900">You disliked all 5 outfit ideas.</p>
                    <p className="text-sm text-slate-600">
                      {showStartOverOnlyInModal
                        ? "You have already retried this plan a few times. Start over and build a fresh wardrobe run."
                        : "Let the wardrobe remix the whole week and try a fresh set of combinations."}
                    </p>
                  </div>

                  <div className={`rounded-2xl border px-4 py-3 text-left ${showStartOverOnlyInModal ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Retry meter</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${showStartOverOnlyInModal ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                        {showStartOverOnlyInModal
                          ? "Start Over unlocked"
                          : `${remainingStyleResetTries} ${remainingStyleResetTries === 1 ? "try" : "tries"} left`}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {Array.from({ length: MAX_STYLE_RESET_TRIES }).map((_, index) => (
                        <span
                          key={index}
                          className={`h-2 flex-1 rounded-full ${index < styleResetTriggerCount ? "bg-rose-400" : showStartOverOnlyInModal ? "bg-rose-200" : "bg-emerald-300"}`}
                        />
                      ))}
                    </div>
                    <p className={`mt-2 text-xs ${showStartOverOnlyInModal ? "text-rose-700" : "text-amber-800"}`}>
                      {showStartOverOnlyInModal
                        ? "You have used all wardrobe remix tries. The next step is to start over with a fresh run."
                        : `You can refresh the full week ${remainingStyleResetTries} more ${remainingStyleResetTries === 1 ? "time" : "times"} before Start Over becomes the only option.`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {showStartOverOnlyInModal ? (
                      <button
                        type="button"
                        onClick={handleStartOver}
                        className="rounded-full border border-slate-200 bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                      >
                        Start Over
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCloseRefreshWeekModal}
                          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Keep current week
                        </button>
                        <button
                          type="button"
                          onClick={handleRefreshWeek}
                          disabled={isRefreshingWeek}
                          className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:from-sky-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRefreshingWeek ? "Refreshing week..." : "Refresh week"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
