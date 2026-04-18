# Course Schedule Generator

Simple full-stack web app for generating and optimizing a weekly course schedule.

## Stack

- Frontend: React (Vite) + Tailwind CSS
- Backend: Node.js + Express
- Data: in-memory mock dataset (no database)
- Auth: none

## Project Structure

- `frontend/` - React UI (schedule grid, course panel, optimize modal, chatbot)
- `backend/` - Express API (`/addCourse`, `/optimize`, `/chat`)

## Run Locally

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs on `http://localhost:3001`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Environment Variables

Backend (`backend/.env`):

- `PORT=3001` (optional)
- `OPENAI_API_KEY= your_key_here` (required for live chatbot responses)
- `OPENAI_MODEL=gpt-4.1-mini` (optional)

If `OPENAI_API_KEY` is missing, `/chat` returns a fallback response instead of failing.

## Core Features Implemented

- Weekly schedule grid (Mon-Fri, 9 AM-6 PM)
- Add course by course number (default section auto-selected)
- Section picker per added course
- Schedule optimization (`packed` vs `spread`) using random search and overlap penalties
- Chatbot with backend LLM integration
