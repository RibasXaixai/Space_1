import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getClothingItems, deleteClothing, updateClothing } from "../services/clothing";
import ClothingCard from "../components/ClothingCard";
import type { ClothingItem, ClothingUpdatePayload } from "../types";

export default function WardrobePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClothingUpdatePayload>({
    category: "",
    color: "",
    style: "",
    warmth_level: "",
    weather_suitability: "",
    notes: "",
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getClothingItems(token)
      .then((response) => {
        setItems(response.data);
      })
      .catch(() => setError("Unable to load wardrobe items."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleEdit = (item: ClothingItem) => {
    setSelectedItem(item);
    setFormState({
      category: item.category ?? "",
      color: item.color ?? "",
      style: item.style ?? "",
      warmth_level: item.warmth_level ?? "",
      weather_suitability: item.weather_suitability ?? "",
      notes: item.notes ?? "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!token || !window.confirm("Delete this clothing item?")) {
      return;
    }
    try {
      await deleteClothing(id, token);
      setItems((current) => current.filter((item) => item.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    } catch {
      setError("Unable to delete the item.");
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem || !token) {
      return;
    }

    try {
      const response = await updateClothing(selectedItem.id, formState, token);
      setItems((current) =>
        current.map((item) => (item.id === selectedItem.id ? response.data : item))
      );
      setSelectedItem(null);
    } catch {
      setError("Unable to update the clothing item.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Your Wardrobe</h2>
          <p className="mt-2 text-sm text-slate-600">View and manage uploaded clothing items.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/upload")}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Add New Clothing
        </button>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">Loading wardrobe items...</div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
          No wardrobe items yet. Upload a clothing photo to get started.
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <ClothingCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>

      {selectedItem ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Edit clothing item</h3>
          <form className="mt-6 space-y-4" onSubmit={handleUpdate}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <input
                  value={formState.category}
                  onChange={(event) => setFormState({ ...formState, category: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Color</span>
                <input
                  value={formState.color}
                  onChange={(event) => setFormState({ ...formState, color: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Style</span>
                <input
                  value={formState.style}
                  onChange={(event) => setFormState({ ...formState, style: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Warmth level</span>
                <input
                  value={formState.warmth_level}
                  onChange={(event) => setFormState({ ...formState, warmth_level: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Weather suitability</span>
              <input
                value={formState.weather_suitability}
                onChange={(event) => setFormState({ ...formState, weather_suitability: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={formState.notes}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
