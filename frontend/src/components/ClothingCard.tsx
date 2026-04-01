import type { ClothingItem } from "../types";

interface ClothingCardProps {
  item: ClothingItem;
  onEdit: (item: ClothingItem) => void;
  onDelete: (id: number) => void;
}

export default function ClothingCard({ item, onEdit, onDelete }: ClothingCardProps) {
  const imageUrl = `${import.meta.env.VITE_API_URL || ""}${item.image_url}`;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <img className="h-56 w-full object-cover" src={imageUrl} alt={item.category || "Clothing item"} />
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Category</p>
            <p className="text-base font-semibold text-slate-900">{item.category || "Unknown"}</p>
          </div>
          <div className="text-sm text-slate-500">{new Date(item.created_at).toLocaleDateString()}</div>
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <p>Color: {item.color || "N/A"}</p>
          <p>Style: {item.style || "N/A"}</p>
          <p>Warmth: {item.warmth_level || "N/A"}</p>
          <p>Weather: {item.weather_suitability || "N/A"}</p>
          <p>Notes: {item.notes || "None"}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
