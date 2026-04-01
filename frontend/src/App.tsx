import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";

function App() {
  return (
    <div className="min-h-screen bg-app-bg text-slate-900">
      <BrowserRouter>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-lg backdrop-blur sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI Wardrobe Planner</h1>
              <p className="mt-2 text-sm text-slate-600">
                One smooth journey from closet photos to weather-ready outfit missions.
              </p>
            </div>
            <nav className="flex flex-wrap gap-3 text-sm text-slate-600">
              <Link className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 font-medium transition hover:bg-slate-200" to="/">
                Home
              </Link>
            </nav>
          </header>

          <main>
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
