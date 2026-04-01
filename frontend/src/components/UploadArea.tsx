import { ChangeEvent, useRef } from "react";
import type { DragEvent } from "react";

interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  loading?: boolean;
  uploadedCount?: number;
  totalCount?: number;
}

export default function UploadArea({ onFilesSelected, loading, uploadedCount = 0, totalCount = 0 }: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProgress = loading && totalCount > 0;
  const progressPercent = hasProgress
    ? Math.min(100, Math.round((uploadedCount / totalCount) * 100))
    : 0;

  const handleClick = () => {
    if (loading) return;
    inputRef.current?.click();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (loading) {
      event.target.value = "";
      return;
    }
    const files = event.target.files;
    if (files) {
      onFilesSelected(Array.from(files));
      // Reset input so same file can be re-selected
      event.target.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;
    const files = event.dataTransfer.files;
    if (files) {
      onFilesSelected(Array.from(files));
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`group rounded-3xl border-2 border-dashed border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 p-8 transition duration-200 sm:p-12 ${
        loading
          ? "cursor-not-allowed opacity-70 pointer-events-none"
          : "cursor-pointer hover:border-sky-400 hover:from-sky-100 hover:to-cyan-100"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <div className="text-center">
        <div className="mb-4 text-5xl transition group-hover:scale-105">📸</div>
        <p className="text-lg font-semibold text-slate-900">Drop your wardrobe photos here</p>
        <p className="mt-2 text-sm text-slate-600">
          Click or drag and drop your clothing items here (JPEG, PNG)
        </p>
        <div className="mt-4 inline-flex min-w-[140px] justify-center rounded-full border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 shadow-sm">
          {hasProgress ? `Uploading ${uploadedCount}/${totalCount}` : loading ? "Uploading..." : "Select photos"}
        </div>
        {hasProgress && (
          <div className="mx-auto mt-4 w-full max-w-sm">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{uploadedCount}/{totalCount}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Tip: upload clear front-facing photos for better analysis.</p>
      </div>
    </div>
  );
}
