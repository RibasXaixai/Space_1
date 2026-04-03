import { useState, useRef } from "react";
import type { UploadedClothing, ClothingAnalysis } from "../types/phase2";

interface EditableClothingItemProps {
  item: UploadedClothing;
  onAnalysisChange: (id: string, analysis: ClothingAnalysis) => void;
  onRemove: (id: string) => void;
  onReplace?: (id: string, file: File) => void;
  disabled?: boolean;
}

function getBarcodeInspiredId(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000;
  }
  return String(hash).padStart(6, "0");
}

function getWardrobeTypeLabel(category?: string): string {
  const normalized = (category || "").trim().toLowerCase();
  if (["t-shirt", "shirt", "blouse", "sweater", "hoodie", "top", "tee", "tank"].some((token) => normalized.includes(token))) {
    return "Top";
  }
  if (["jeans", "pants", "trouser", "shorts", "skirt", "leggings"].some((token) => normalized.includes(token))) {
    return "Bottom";
  }
  if (["dress"].some((token) => normalized.includes(token))) {
    return "Dress";
  }
  if (["jacket", "coat", "cardigan", "blazer", "parka", "raincoat"].some((token) => normalized.includes(token))) {
    return "Outerwear";
  }
  if (["shoe", "sneaker", "boot", "sandal", "loafer", "heel"].some((token) => normalized.includes(token))) {
    return "Shoes";
  }
  return "Other";
}

export default function EditableClothingItem({
  item,
  onAnalysisChange,
  onRemove,
  onReplace,
  disabled,
}: EditableClothingItemProps) {
  const isNeedsReview = item.status === "needs_review";
  const isRejected = item.status === "rejected";
  const displayCode = getBarcodeInspiredId(item.id);
  const itemTypeLabel = getWardrobeTypeLabel(item.analyzed?.category);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ClothingAnalysis>(
    item.analyzed || {
      category: "",
      color: "",
      style: "",
      warmth_level: "",
      weather_suitability: "",
      gender: "Unisex",
      notes: "",
    }
  );

  const categories = [
    "T-Shirt",
    "Jeans",
    "Jacket",
    "Sweater",
    "Dress",
    "Shirt",
    "Pants",
    "Shorts",
    "Skirt",
    "Hoodie",
    "Shoes",
    "Boots",
    "Sneakers",
    "Coat",
    "Blouse",
  ];
  const colors = [
    "Blue",
    "Black",
    "White",
    "Red",
    "Green",
    "Gray",
    "Navy",
    "Beige",
    "Brown",
    "Pink",
    "Purple",
    "Yellow",
  ];
  const styles = ["Casual", "Formal", "Smart Casual", "Athletic", "Vintage", "Modern", "Streetwear", "Classic"];
  const warmthLevels = ["Light", "Medium", "Heavy"];
  const weatherOptions = ["Spring/Summer", "Fall/Winter", "All-Weather", "VariableSeason", "Indoor"];
  const genderOptions = ["Male", "Female", "Unisex"];

  const handleSaveEdits = () => {
    onAnalysisChange(item.id, editData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-3xl border-2 border-sky-400 bg-sky-50 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">{isNeedsReview ? "Review Clothing Item" : "Edit Clothing Item"}</h3>
            {!isRejected && (
              <p className="mt-1 font-mono text-[11px] tracking-[0.3em] text-slate-500">ID {displayCode}</p>
            )}
          </div>
          <button
            onClick={() => setIsEditing(false)}
            disabled={disabled}
            className="text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {!isNeedsReview && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={editData.category}
                  onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                <select
                  value={editData.color}
                  onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select color</option>
                  {colors.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Style</label>
                <select
                  value={editData.style}
                  onChange={(e) => setEditData({ ...editData, style: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select style</option>
                  {styles.map((sty) => (
                    <option key={sty} value={sty}>
                      {sty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Warmth Level</label>
                <select
                  value={editData.warmth_level}
                  onChange={(e) => setEditData({ ...editData, warmth_level: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select warmth</option>
                  {warmthLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Weather Suitability</label>
                <select
                  value={editData.weather_suitability}
                  onChange={(e) => setEditData({ ...editData, weather_suitability: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select weather suitability</option>
                  {weatherOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  value={editData.gender}
                  onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select gender</option>
                  {genderOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              disabled={disabled || isNeedsReview}
              readOnly={isNeedsReview}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            {isNeedsReview ? (
              <button
                onClick={() => setIsEditing(false)}
                disabled={disabled}
                className="w-full rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveEdits}
                  disabled={disabled}
                  className="flex-1 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={disabled}
                  className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Display mode

  // Rejected card — shown before isEditing check so it always renders as non-editable
  if (isRejected) {
    return (
      <div className="overflow-hidden rounded-3xl border-2 border-rose-400 bg-rose-50 shadow-sm">
        <img
          src={item.preview}
          alt="rejected clothing item"
          className="h-48 w-full object-cover opacity-60"
        />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="inline-block rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800">
                ✕ Rejected
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="rounded-full bg-red-50 border border-red-200 p-2 text-red-600 hover:bg-red-100 transition disabled:cursor-not-allowed disabled:opacity-50"
              title="Remove item"
            >
              ✕
            </button>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-white p-3 text-xs space-y-1">
            <p className="font-semibold text-rose-800">This image was rejected</p>
            <p className="text-rose-700">
              {item.reject_reason || "This image could not be used as a clothing item."}
            </p>
          </div>

          <div className="flex gap-2">
            {onReplace && (
              <>
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onReplace(item.id, file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => replaceInputRef.current?.click()}
                  disabled={disabled}
                  className="flex-1 rounded-full border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Replace image
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="flex-1 rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove image
            </button>
          </div>
        </div>
      </div>
    );
  }

  const borderClass = item.is_exact_duplicate
    ? "border-2 border-purple-400 bg-purple-50"
    : item.is_similar_duplicate
    ? "border-2 border-violet-400 bg-violet-50"
    : "border border-slate-200 bg-white";

  return (
    <div className={`overflow-hidden rounded-3xl shadow-sm ${borderClass}`}>
      <img
        src={item.preview}
        alt="clothing item"
        className="h-48 w-full object-cover"
      />
      <div className="p-4 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Wardrobe ID</p>
              <p className="mt-1 font-mono text-xs font-bold tracking-[0.3em] text-slate-900">{displayCode}</p>
            </div>
            <div className="flex h-7 items-end gap-[2px]" aria-hidden="true">
              {displayCode.split("").map((digit, idx) => (
                <span
                  key={`${digit}-${idx}`}
                  className="w-1 rounded-sm bg-slate-700"
                  style={{ height: `${10 + Number(digit) * 2}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div>
            {item.analyzed && (
              <div className="space-y-1">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {itemTypeLabel}
                </span>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Category</p>
                <p className="text-sm font-semibold text-slate-900">
                  {isNeedsReview ? "Needs confirmation" : item.analyzed.category}
                </p>
                {isNeedsReview ? (
                  <span
                    className="inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                  >
                    Needs review
                  </span>
                ) : (
                  item.analysis_source && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        item.analysis_source === "ai"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.analysis_source === "ai" ? "AI analyzed" : "Fallback analyzed"}
                    </span>
                  )
                )}
                {item.is_exact_duplicate && (
                  <span className="inline-block ml-2 rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800">
                    ⚠️ Exact duplicate
                  </span>
                )}
                {item.is_similar_duplicate && !item.is_exact_duplicate && (
                  <span className="inline-block ml-2 rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                    ⚠️ Similar image
                  </span>
                )}
                {item.validation_warning && !isNeedsReview && !item.is_exact_duplicate && !item.is_similar_duplicate && (
                  <span className="inline-block ml-2 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700" title={item.validation_warning}>
                    ℹ️ Low resolution
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            className="rounded-full bg-red-50 border border-red-200 p-2 text-red-600 hover:bg-red-100 transition disabled:cursor-not-allowed disabled:opacity-50"
            title="Remove item"
          >
            ✕
          </button>
        </div>

        {item.analyzed && !isNeedsReview && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Color</p>
              <p className="font-medium text-slate-900">{item.analyzed.color}</p>
            </div>
            <div>
              <p className="text-slate-500">Style</p>
              <p className="font-medium text-slate-900">{item.analyzed.style}</p>
            </div>
            <div>
              <p className="text-slate-500">Warmth</p>
              <p className="font-medium text-slate-900">{item.analyzed.warmth_level}</p>
            </div>
            <div>
              <p className="text-slate-500">Weather</p>
              <p className="font-medium text-slate-900">{item.analyzed.weather_suitability}</p>
            </div>
            <div>
              <p className="text-slate-500">Gender</p>
              <p className="font-medium text-slate-900">{item.analyzed.gender || "Unisex"}</p>
            </div>
          </div>
        )}

        {item.analyzed && isNeedsReview && (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs">
            <div>
              <p className="text-amber-700">Reason</p>
              <p className="font-medium text-amber-900">{item.review_reason || "We could not confidently analyze this image."}</p>
            </div>
            <div>
              <p className="text-amber-700">Issue</p>
              <p className="font-medium text-amber-900">{item.review_issue || "The photo may be unclear, incomplete, or may not show a full clothing item."}</p>
            </div>
            <div>
              <p className="text-amber-700">Usage</p>
              <p className="font-medium text-amber-900">This item will not be used in outfit recommendations until reviewed.</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={disabled}
          className="w-full rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isNeedsReview ? "📝 Review item" : "✏️ Edit"}
        </button>
      </div>
    </div>
  );
}
