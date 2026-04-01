import { ChangeEvent, useRef } from "react";
import type { DragEvent } from "react";

interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  loading?: boolean;
}

export default function UploadArea({ onFilesSelected, loading }: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
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
      className="group cursor-pointer rounded-3xl border-2 border-dashed border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 p-8 transition duration-200 hover:border-sky-400 hover:from-sky-100 hover:to-cyan-100 sm:p-12"
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
          {loading ? "Uploading..." : "Select photos"}
        </div>
        <p className="mt-3 text-xs text-slate-500">Tip: upload clear front-facing photos for better analysis.</p>
      </div>
    </div>
  );
}
