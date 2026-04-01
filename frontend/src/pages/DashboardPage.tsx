import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserLocation, updateUserLocation } from "../services/location";
import { getWeatherForecast } from "../services/weather";
import { getRecommendationAnalytics } from "../services/recommendations";
import type { RecommendationAnalytics, WeatherForecast } from "../types";

export default function DashboardPage() {
  const { user, token, logout } = useAuth();
  const [location, setLocation] = useState(user?.location ?? "");
  const [locationDraft, setLocationDraft] = useState(user?.location ?? "");
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<RecommendationAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getUserLocation(token)
      .then((response) => {
        const storedLocation = response.data.location ?? "";
        setLocation(storedLocation);
        setLocationDraft(storedLocation);
      })
      .catch(() => setMessage("Unable to load saved location."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !location) {
      setWeather(null);
      return;
    }

    getWeatherForecast(token)
      .then((response) => setWeather(response.data))
      .catch(() => setMessage("Unable to fetch weather forecast."));
  }, [token, location]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setAnalyticsError(null);
    getRecommendationAnalytics(token)
      .then((response) => setAnalytics(response.data))
      .catch(() => setAnalyticsError("Unable to load recommendation analytics."));
  }, [token]);

  const handleLocationSave = async () => {
    if (!token) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await updateUserLocation(locationDraft, token);
      setLocation(response.data.location);
      setMessage("Location updated successfully.");
    } catch {
      setMessage("Unable to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
            <p className="mt-2 text-slate-600">
              Manage your location and see the upcoming weather forecast.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-6">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="mt-2 text-lg font-medium text-slate-900">{user?.email}</p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Location</h3>
            <p className="mt-2 text-slate-600">Set your city or postal code to fetch weather for your area.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={locationDraft}
              onChange={(event) => setLocationDraft(event.target.value)}
              placeholder="Enter city or postal code"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <button
              type="button"
              disabled={saving}
              onClick={handleLocationSave}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save location"}
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading your saved location...</p>
          ) : location ? (
            <p className="text-sm text-slate-600">Current saved location: <span className="font-semibold text-slate-900">{location}</span></p>
          ) : (
            <p className="text-sm text-slate-500">No location saved yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">5-day weather forecast</h3>
            <p className="mt-2 text-slate-600">Forecast based on your saved location.</p>
          </div>
          {weather?.location ? (
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{weather.location}</div>
          ) : null}
        </div>

        {message ? (
          <p className="mt-4 text-sm text-rose-600">{message}</p>
        ) : null}

        {analyticsError ? (
          <p className="mt-4 text-sm text-rose-600">{analyticsError}</p>
        ) : null}

        {!weather ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
            Weather forecast will appear once a location is saved.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {weather.forecast.map((day) => (
              <div key={day.date} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-500">{day.date}</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{day.condition || "N/A"}</p>
                <p className="mt-2 text-sm text-slate-600">High: {day.max_temp_c ?? "--"}°C</p>
                <p className="text-sm text-slate-600">Low: {day.min_temp_c ?? "--"}°C</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Recommendation analytics</h3>
            <p className="mt-2 text-slate-600">See how many recommendations you liked and which styles you prefer.</p>
          </div>

          {!analytics ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              Recommendation analytics will appear after feedback is submitted.
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-3xl bg-slate-50 p-6">
                <p className="text-sm text-slate-500">Total feedback saved</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{analytics.total_recommendations}</p>
                <div className="mt-6 flex gap-4">
                  <div className="rounded-3xl bg-white p-4 text-slate-700 shadow-sm">
                    <p className="text-sm text-slate-500">Liked</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700">{analytics.liked}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 text-slate-700 shadow-sm">
                    <p className="text-sm text-slate-500">Disliked</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-700">{analytics.disliked}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-3xl bg-slate-50 p-6">
                  <p className="text-sm text-slate-500">Top liked categories</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {analytics.top_liked_categories.length > 0 ? (
                      analytics.top_liked_categories.map((item) => (
                        <li key={item.name}>{item.name} ({item.count})</li>
                      ))
                    ) : (
                      <li className="text-slate-400">No data yet.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-3xl bg-slate-50 p-6">
                  <p className="text-sm text-slate-500">Top liked styles</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {analytics.top_liked_styles.length > 0 ? (
                      analytics.top_liked_styles.map((item) => (
                        <li key={item.name}>{item.name} ({item.count})</li>
                      ))
                    ) : (
                      <li className="text-slate-400">No data yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
