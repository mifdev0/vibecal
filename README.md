# VibeCal (The Zero-Effort AI Calendar)

VibeCal is a high-fidelity, AI-powered scheduling application built for the Google Vibe Coding Competition. It eliminates the friction of traditional calendar apps by allowing users to schedule events using natural language (Indonesian/English) via text or voice.

## 🚀 Features

- **Natural Language Parsing:** Powered by **Google Gemini 1.5 Flash** to extract complex scheduling intent.
- **Zero-Friction Onboarding:** Guest-session based system using UUIDs stored in `localStorage`.
- **Fluid UI/UX:** Built with Next.js, Tailwind CSS, and Framer Motion for a "Neon Cyber-Minimalism" aesthetic.
- **Interactive Calendar:** FullCalendar integration with Day, Week, and Month views.
- **Voice-to-Schedule:** Integrated Web Speech API for hands-free scheduling.
- **Dynamic Categorization:** Automatically maps events to Work, Social, Health, or Me-Time.

## 🛠 Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Lucide React, Framer Motion, FullCalendar.
- **Backend:** Node.js, Express, Morgan, Cors.
- **AI:** Google Generative AI SDK (Gemini 1.5 Flash).
- **Database:** Supabase (PostgreSQL).
- **Deployment:** Docker, Google Cloud Run (Back-end).

## 📥 Getting Started

### 1. Prerequisites
- Node.js 18+
- A Supabase account and project.
- A Google Cloud API Key for Gemini.

### 2. Database Setup
Run the following SQL in your Supabase SQL Editor to create the necessary table:

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    vibe_category VARCHAR(50) NOT NULL,
    raw_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_time_range ON events(start_time, end_time);
```

### 3. Environment Variables

#### Backend (`backend/.env`)
Create a `.env` file in the `backend` directory:
```env
PORT=8080
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

#### Frontend (`frontend/.env.local`)
Create a `.env.local` file in the `frontend` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 4. Installation & Development

From the root directory:

```bash
# Install all dependencies
npm run install:all

# Run both backend and frontend concurrently
npm run dev
```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:8080`.

## 🚢 Deployment (Google Cloud Run)

To deploy the backend to Cloud Run:

```bash
cd backend
gcloud run deploy vibecal-backend \
    --source . \
    --allow-unauthenticated \
    --region asia-southeast1 \
    --port 8080 \
    --update-env-vars SUPABASE_URL=your_url,SUPABASE_KEY=your_key,GEMINI_API_KEY=your_key
```

## 📝 License
ISC
