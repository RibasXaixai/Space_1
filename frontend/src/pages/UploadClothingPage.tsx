import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { uploadClothing } from "../services/clothing";
import type { ClothingItem } from "../types";

export default function UploadClothingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [style, setStyle] = useState("");
  const [warmthLevel, setWarmthLevel] = useState("");
  const [weatherSuitability, setWeatherSuitability] = useState("");
  const [notes, setNotes] = useState("");
  const [createdItem, setCreatedItem] = useState<ClothingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file || !token) {
      setError("Please select an image file and sign in first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("color", color);
    formData.append("style", style);
    formData.append("warmth_level", warmthLevel);
    formData.append("weather_suitability", weatherSuitability);
    formData.append("notes", notes);

    setSubmitting(true);
    try {
      const response = await uploadClothing(formData, token);
      setCreatedItem(response.data);
      setCategory(response.data.category ?? "");
      setColor(response.data.color ?? "");
      setStyle(response.data.style ?? "");
      setWarmthLevel(response.data.warmth_level ?? "");
      setWeatherSuitability(response.data.weather_suitability ?? "");
      setNotes(response.data.notes ?? "");
    } catch {
      setError("Failed to upload clothing item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const previewUrl = createdItem ? `${import.meta.env.VITE_API_URL || ""}${createdItem.image_url}` : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Upload Clothing</h2>
      <p className="mt-3 text-slate-600">Add a clothing photo to save it in your wardrobe.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Color</span>
            <input
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Style</span>
            <input
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Warmth level</span>
            <input
              value={warmthLevel}
              onChange={(event) => setWarmthLevel(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Weather suitability</span>
          <input
            value={weatherSuitability}
            onChange={(event) => setWeatherSuitability(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Uploading..." : "Upload clothing"}
        </button>
      </form>

      {createdItem ? (
        <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-700 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Detected clothing details</h3>
          <p className="mt-2 text-sm text-slate-600">
            AI has analyzed your photo. You can edit these values in the wardrobe after upload.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Category</p>
              <p className="mt-1 text-base text-slate-900">{createdItem.category || "unknown"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Color</p>
              <p className="mt-1 text-base text-slate-900">{createdItem.color || "unknown"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Style</p>
              <p className="mt-1 text-base text-slate-900">{createdItem.style || "basic"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Warmth level</p>
              <p className="mt-1 text-base text-slate-900">{createdItem.warmth_level || "medium"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-slate-700">Weather suitability</p>
              <p className="mt-1 text-base text-slate-900">{createdItem.weather_suitability || "general"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-slate-700">Notes</p>
              <p className="mt-1 text-base text-slate-900">{createdItem.notes || "No notes"}</p>
            </div>
          </div>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Uploaded clothing"
              className="mt-6 h-64 w-full rounded-3xl object-cover"
            />
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/wardrobe")}
            className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            View wardrobe
          </button>
        </div>
      ) : null}
    </div>
  );
}
