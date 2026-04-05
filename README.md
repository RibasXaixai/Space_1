# Amazing Wardrobe Planner

A full-stack web app that helps a user upload clothing photos, check the weather for a trip, and generate a simple 5-day outfit plan.

## Live Links

- **Frontend:** `https://ribasxaixai.github.io/Space_1/`
- **Backend health check:** `https://space-1-r5dq.onrender.com/health/`

---

## Project Overview

This project was built as an MVP submission. The main flow is:

1. Upload clothing photos
2. Review or confirm detected clothing items
3. Enter a trip location
4. Fetch a 5-day weather forecast
5. Generate outfit recommendations for each day
6. Refresh a day if the user does not like the suggestion
7. Optionally send the final plan by email as a PDF attachment

## Main Features

- Multi-image clothing upload
- Clothing analysis with OpenAI support and fallback behavior
- 5-day weather forecast using WeatherAPI
- Outfit recommendation generation based on wardrobe + forecast
- `Refresh day` and `Refresh week` interactions
- Warnings when the wardrobe may not fit the expected weather
- Email export of the wardrobe plan as a PDF
- Responsive React interface for demo/submission use

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, Uvicorn, Python |
| APIs | OpenAI, WeatherAPI, Resend |
| Deployment | GitHub Pages + Render |

## Active MVP Files

- `frontend/src/pages/Home.tsx` — main user flow UI
- `frontend/src/services/phase2.ts` — frontend API calls
- `backend/app/main.py` — FastAPI entrypoint
- `backend/app/routers/upload.py` — upload + clothing analysis
- `backend/app/routers/weather_forecast.py` — weather forecast endpoint
- `backend/app/routers/recommendations.py` — recommendation endpoints

---

## Submission Notes

This repository contains some extra or legacy files from earlier phases, but the **main submission flow** is the deployed web app linked above.

### What is included in the MVP

- Upload and analyze clothing items
- View forecast for a chosen location
- Generate and refresh outfit recommendations
- Display wardrobe warnings for difficult weather situations
- Export the final wardrobe plan by email

### What is intentionally simplified

- No required login for the core demo flow
- No persistent database storage for the MVP interaction
- Recommendation logic is lightweight and demo-friendly
- Some image analyses may require manual review when fallback mode is used

> If OpenAI is unavailable or an image is unclear, an item may appear under **Needs review** before it can be used in recommendations.

---

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

---

## Environment Variables

### Backend (`backend/.env`)

```env
OPENAI_API_KEY=your_openai_api_key
WEATHER_API_KEY=your_weatherapi_key
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=onboarding@resend.dev
DATABASE_URL=postgresql://user:password@localhost:5432/ai_wardrobe
SECRET_KEY=change-me
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

For the deployed version, `VITE_API_URL` points to the Render backend.

---

## API Endpoints Used in the MVP

- `GET /health/`
- `POST /upload-clothing`
- `POST /check-duplicates`
- `POST /weather/forecast`
- `POST /recommendations/generate`
- `POST /recommendations/refresh-day`
- `POST /recommendations/refresh-week`
- `POST /recommendations/email-plan`

---

## Security Note

For this MVP, the main protection added is **server-side rate limiting** on the more expensive AI-related actions. This keeps the demo simple while still showing that abuse prevention was considered.

For a future production version, additional protection such as **reCAPTCHA** would be a reasonable next step.

---

## Shareable Submission Link

If you only need one link for review, share:

**`https://ribasxaixai.github.io/Space_1/`**

