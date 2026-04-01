import type { WeatherForecast } from "../types/phase2";

interface WeatherForecastDisplayProps {
  forecast: WeatherForecast[];
  location: string;
  visible: boolean;
}

export default function WeatherForecastDisplay({
  forecast,
  location,
  visible,
}: WeatherForecastDisplayProps) {
  if (!visible || forecast.length === 0) {
    return null;
  }

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getWeatherEmoji = (condition: string) => {
    const lower = condition.toLowerCase();
    if (lower.includes("sunny") || lower.includes("clear")) return "☀️";
    if (lower.includes("cloud")) return "☁️";
    if (lower.includes("rain")) return "🌧️";
    if (lower.includes("snow")) return "❄️";
    if (lower.includes("storm")) return "⛈️";
    if (lower.includes("wind")) return "💨";
    if (lower.includes("fog")) return "🌫️";
    return "🌤️";
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">5-Day Forecast</h2>
        <p className="mt-2 text-sm text-slate-600">
          📍 <span className="font-semibold">{location}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {forecast.map((day) => {
          const date = new Date(day.date);
          const dayName = daysOfWeek[date.getDay()];
          const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return (
            <div key={day.day} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 text-center">
                <p className="text-sm font-semibold text-slate-900">{dayName}</p>
                <p className="text-xs text-slate-500">{dateStr}</p>
              </div>

              <div className="space-y-3">
                <div className="text-center text-3xl">{getWeatherEmoji(day.condition)}</div>

                <div className="text-center">
                  <p className="text-xs text-slate-600 line-clamp-2">{day.condition}</p>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="text-center text-sm font-semibold text-slate-900">
                    {Math.round(day.temperature)}°C
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-blue-50 p-1.5 text-center">
                    <p className="text-xs text-slate-500">💧</p>
                    <p className="font-medium text-slate-900">{day.humidity}%</p>
                  </div>
                  <div className="rounded bg-cyan-50 p-1.5 text-center">
                    <p className="text-xs text-slate-500">🌧️</p>
                    <p className="font-medium text-slate-900">
                      {day.condition.toLowerCase().includes("rain") ? "High" : "Low"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          💡 Tip
        </p>
        <p>Weather conditions will influence your outfit recommendations. Check the forecast before each day!</p>
      </div>
    </div>
  );
}
