import { useState } from "react";
import type { UploadedClothing, ClothingAnalysis } from "../types/phase2";

interface EditableClothingItemProps {
  item: UploadedClothing;
  onAnalysisChange: (id: string, analysis: ClothingAnalysis) => void;
  onRemove: (id: string) => void;
}

export default function EditableClothingItem({
  item,
  onAnalysisChange,
  onRemove,
}: EditableClothingItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ClothingAnalysis>(
    item.analyzed || {
      category: "",
      color: "",
      style: "",
      warmth_level: "",
      weather_suitability: "",
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

  const handleSaveEdits = () => {
    onAnalysisChange(item.id, editData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-3xl border-2 border-sky-400 bg-sky-50 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Edit Clothing Item</h3>
          <button
            onClick={() => setIsEditing(false)}
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={editData.category}
                onChange={(e) => setEditData({ ...editData, category: e.target.value })}
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveEdits}
              className="flex-1 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <img
        src={item.preview}
        alt="clothing item"
        className="h-48 w-full object-cover"
      />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            {item.analyzed && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Category</p>
                <p className="text-sm font-semibold text-slate-900">{item.analyzed.category}</p>
                {item.analysis_source && (
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      item.analysis_source === "ai"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.analysis_source === "ai" ? "AI analyzed" : "Fallback analyzed"}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded-full bg-red-50 border border-red-200 p-2 text-red-600 hover:bg-red-100 transition"
            title="Remove item"
          >
            ✕
          </button>
        </div>

        {item.analyzed && (
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
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="w-full rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
        >
          ✏️ Edit
        </button>
      </div>
    </div>
  );
}
