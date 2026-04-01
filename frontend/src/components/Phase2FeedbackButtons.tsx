import { useState } from "react";

interface FeedbackButtonsProps {
  onLike?: () => void;
  onDislike?: () => void;
  selectedFeedback?: "like" | "dislike" | null;
  disabled?: boolean;
}

export default function FeedbackButtons({
  onLike,
  onDislike,
  selectedFeedback,
  disabled,
}: FeedbackButtonsProps) {
  const [showLikeCelebrate, setShowLikeCelebrate] = useState(false);

  const playCelebrateSound = () => {
    try {
      const maybeAudioContext = (globalThis as any).AudioContext;
      if (!maybeAudioContext) return;

      const audioContext = new maybeAudioContext();
      const gainNode = audioContext.createGain();

      gainNode.connect(audioContext.destination);

      const note1 = audioContext.createOscillator();
      note1.type = "triangle";
      note1.frequency.setValueAtTime(660, audioContext.currentTime);
      note1.connect(gainNode);

      const note2 = audioContext.createOscillator();
      note2.type = "triangle";
      note2.frequency.setValueAtTime(880, audioContext.currentTime + 0.08);
      note2.connect(gainNode);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);

      note1.start(audioContext.currentTime);
      note1.stop(audioContext.currentTime + 0.08);
      note2.start(audioContext.currentTime + 0.08);
      note2.stop(audioContext.currentTime + 0.2);

      setTimeout(() => {
        audioContext.close().catch(() => {
          // Ignore close errors to keep UX smooth.
        });
      }, 280);
    } catch {
      // If audio is blocked by browser policy, silently continue.
    }
  };

  const playDislikeSound = () => {
    try {
      const maybeAudioContext = (globalThis as any).AudioContext;
      if (!maybeAudioContext) return;

      const audioContext = new maybeAudioContext();
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);

      const note1 = audioContext.createOscillator();
      note1.type = "square";
      note1.frequency.setValueAtTime(440, audioContext.currentTime);
      note1.connect(gainNode);

      const note2 = audioContext.createOscillator();
      note2.type = "square";
      note2.frequency.setValueAtTime(330, audioContext.currentTime + 0.1);
      note2.connect(gainNode);

      const note3 = audioContext.createOscillator();
      note3.type = "square";
      note3.frequency.setValueAtTime(247, audioContext.currentTime + 0.2);
      note3.connect(gainNode);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.36);

      note1.start(audioContext.currentTime);
      note1.stop(audioContext.currentTime + 0.1);
      note2.start(audioContext.currentTime + 0.1);
      note2.stop(audioContext.currentTime + 0.2);
      note3.start(audioContext.currentTime + 0.2);
      note3.stop(audioContext.currentTime + 0.36);

      setTimeout(() => {
        audioContext.close().catch(() => {
          // Ignore close errors to keep UX smooth.
        });
      }, 500);
    } catch {
      // If audio is blocked by browser policy, silently continue.
    }
  };

  const handleLikeClick = () => {
    if (disabled) return;
    playCelebrateSound();
    setShowLikeCelebrate(false);
    setTimeout(() => setShowLikeCelebrate(true), 10);
    setTimeout(() => setShowLikeCelebrate(false), 800);
    onLike?.();
  };

  const handleDislikeClick = () => {
    if (disabled) return;
    playDislikeSound();
    onDislike?.();
  };

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {onLike && (
        <div className="relative">
          <button
            type="button"
            onClick={handleLikeClick}
            disabled={disabled}
            className={
              selectedFeedback === "like"
                ? "relative rounded-full border border-green-700 bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                : "relative rounded-full border border-green-200 bg-green-50 px-6 py-3 text-sm font-semibold text-green-700 transition hover:border-green-300 hover:bg-green-100 disabled:opacity-50"
            }
          >
            👍 Like
          </button>
          {showLikeCelebrate && (
            <>
              <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 animate-bounce text-sm">
                ✨
              </span>
              <span className="pointer-events-none absolute -top-1 right-2 animate-ping text-xs">
                🎉
              </span>
              <span className="pointer-events-none absolute -top-1 left-2 animate-ping text-xs">
                ✨
              </span>
            </>
          )}
        </div>
      )}
      {onDislike && (
        <button
          type="button"
          onClick={handleDislikeClick}
          disabled={disabled}
          className={
            selectedFeedback === "dislike"
              ? "rounded-full border border-red-700 bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              : "rounded-full border border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
          }
        >
          👎 Don't like
        </button>
      )}
    </div>
  );
}
