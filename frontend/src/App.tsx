import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

function App() {
  return (
    <div className="min-h-screen bg-app-bg text-slate-900">
      <BrowserRouter>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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
