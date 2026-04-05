# Amazing Wardrobe Planner

Amazing Wardrobe Planner is a full-stack app that helps users upload clothes, fetch a 5-day weather forecast, and generate daily outfit recommendations.

## Tech Stack

- Backend: FastAPI, Uvicorn, Python
- Frontend: React, TypeScript, Vite, Tailwind CSS
- AI + APIs: OpenAI (image analysis), WeatherAPI (forecast)

## Project Structure

- `backend/app/main.py`: FastAPI entrypoint and active route registration.
- `backend/app/routers/upload.py`: upload and clothing analysis endpoint.
- `backend/app/routers/weather_forecast.py`: 5-day weather endpoint.
- `backend/app/routers/recommendations.py`: recommendation generation endpoint.
- `frontend/src/pages/Home.tsx`: complete MVP flow UI.
- `frontend/src/services/phase2.ts`: frontend API integration used by the MVP flow.

## What Is Implemented

- Multi-image clothing upload.
- Clothing analysis using OpenAI Vision (with fallback behavior when unavailable).
- Location-based 5-day weather forecast using WeatherAPI.
- Rule-based outfit recommendations for the next 5 days.
- Wardrobe viability warnings (cold/rain/hot edge cases).
- Per-day Like / Don’t like frontend feedback state.
- Polished responsive UI with loading, empty, and error states.

## What Is Simplified

- No user accounts in the active MVP flow.
- No persistent feedback storage.
- No database persistence required for the core flow.
- Recommendation logic is rule-based and intentionally lightweight.

## Required API Keys

- `OPENAI_API_KEY`: required for real clothing image analysis.
- `WEATHER_API_KEY`: required for real weather forecast data.

If either key is missing, related features will return fallback behavior or unavailability errors.

## Environment Setup

Use the templates:

- `backend/.env.example`
- `frontend/.env.example`
- `.env.example` (reference copy)

### Backend `.env`

Create `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key
WEATHER_API_KEY=your_weatherapi_key
DATABASE_URL=postgresql://user:password@localhost:5432/ai_wardrobe
SECRET_KEY=change-me
```

`DATABASE_URL` and `SECRET_KEY` are kept for compatibility with non-MVP modules, but not required for the active MVP route flow.

### Frontend `.env`

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## Local Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API Route Structure (Active MVP)

- `GET /health/`
- `POST /upload-clothing`
- `POST /weather/forecast`
- `POST /recommendations/generate`

## Version 5 - MVP Security Note

Because this project is being reviewed as an **instructor-facing MVP**, the current protection layer focuses on **server-side rate limiting** for the expensive OpenAI-powered actions instead of making `reCAPTCHA` mandatory right now.

### Why this is enough for the MVP

- It demonstrates that abuse risk was considered for guest-facing AI buttons.
- It protects the most expensive routes such as upload analysis and recommendation generation.
- It keeps the demo flow simple and avoids extra setup, API keys, and UI friction during review.

### Production follow-up

For a public release, the next hardening step would be to add **reCAPTCHA** (or similar bot protection) on top of the backend rate limits.

> Note: for this MVP, we did **not** do deep tuning on the exact number of clicks/requests needed to trigger the block. The current thresholds are intentionally simple demo-safe defaults and would be calibrated further for a real production rollout.

## Notes For Handoff

- Backend now loads environment variables from `backend/.env` at startup.
- Frontend MVP API calls are centralized in `frontend/src/services/phase2.ts` for consistency.
- The React frontend is the main app to share for review; `localhost` links only work on the local machine, so the project must be deployed to share it with an instructor.
- Wardrobe-plan emails now send a short summary in the email body and attach the full multi-page visual plan as a PDF.
- Legacy/non-MVP modules may remain in the repository but are not part of the active handoff flow.
