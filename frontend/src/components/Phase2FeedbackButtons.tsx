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
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {onLike && (
        <button
          type="button"
          onClick={onLike}
          disabled={disabled}
          className={
            selectedFeedback === "like"
              ? "rounded-full border border-green-700 bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
              : "rounded-full border border-green-200 bg-green-50 px-6 py-3 text-sm font-semibold text-green-700 transition hover:border-green-300 hover:bg-green-100 disabled:opacity-50"
          }
        >
          👍 Like
        </button>
      )}
      {onDislike && (
        <button
          type="button"
          onClick={onDislike}
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
