import { ChangeEvent } from "react";

interface LocationInputProps {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
}

export default function LocationInput({ value, onChange, placeholder }: LocationInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-start gap-4">
        <div className="mt-1 text-3xl">📍</div>
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Mission Location
          </label>
          <p className="mb-3 text-xs text-slate-500">Use city and country for the best forecast accuracy.</p>
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder || "e.g., New York, NY or London, UK"}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
          <p className="mt-2 text-xs text-slate-500">
            We'll use this to get weather forecasts for your outfit recommendations
          </p>
        </div>
      </div>
    </div>
  );
}
