import { ChangeEvent } from "react";

interface LocationInputProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function LocationInput({ value, onChange, placeholder, disabled = false }: LocationInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange(event.target.value);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-start gap-4">
        <div className="mt-1 text-3xl">📍</div>
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Trip Location
          </label>
          <p className="mb-3 text-xs text-slate-500">Use city and country for the best forecast accuracy.</p>
          <input
            type="text"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            placeholder={placeholder || "e.g., New York, NY or London, UK"}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <p className="mt-2 text-xs text-slate-500">
            {disabled
              ? "Wait until the clothing upload finishes before entering your trip location."
              : "We'll use this to get weather forecasts for your outfit recommendations"}
          </p>
        </div>
      </div>
    </div>
  );
}
