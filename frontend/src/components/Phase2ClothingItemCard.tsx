import type { UploadedClothing } from "../types/phase2";

interface ClothingItemCardProps {
  item: UploadedClothing;
  onRemove: (id: string) => void;
}

export default function ClothingItemCard({ item, onRemove }: ClothingItemCardProps) {
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
      </div>
    </div>
  );
}
