# AI Wardrobe Planner - Phase 1 Bootstrap

## Backend

- Folder: `backend/app/`
- Entry: `backend/app/main.py`
- Health route: `GET /health`
- CORS enabled for local frontend ports
- Configuration loaded from `backend/.env.example`
- Dependencies listed in `backend/requirements.txt`

## Frontend

- Vite + React + TypeScript + Tailwind CSS
- Entry: `frontend/src/main.tsx`
- Landing page: `frontend/src/pages/Home.tsx`
- Axios API setup: `frontend/src/services/api.ts`
- React Router placeholder routes for home, login, register
- Environment example: `frontend/.env.example`

## Run

### Backend

1. Create a Python environment.
2. Install dependencies:
   ```bash
   cd backend
   python -m pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```

## Notes

This phase creates the boilerplate structure for the backend and frontend. The backend health route is available at `http://localhost:8000/health`. The frontend is ready to connect to the backend via `VITE_API_URL`.
