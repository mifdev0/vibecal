# Product Requirement Document (PRD)

## Project Name: VibeCal (The Zero-Effort AI Calendar)
**Version:** 1.0 (MVP)  
**Target Platform:** Web Application (Responsive Desktop & Mobile)  
**Deployment Target:** Google Cloud Run (Stateless Container)  
**Database & Infrastructure:** Supabase (PostgreSQL + Auth)  

---

## 1. Executive Summary & Problem Statement
Traditional calendar applications present a high-friction user experience. Users are forced to navigate multiple date pickers, time dropdowns, form fields, and category tags just to log a single event. This administrative burden leads to skipped logging, scheduling conflicts, and general friction.

**VibeCal** revolutionizes personal scheduling by removing the traditional manual "+" button entirely. It leverages a natural language processing pipeline driven by **Google Gemini 1.5 Flash** to extract complex scheduling intent from casual, slang-heavy Indonesian or English text and voice prompts. Built with a high-fidelity, interactive, and playful UI/UX, VibeCal transforms a dry administrative task into a delightful, gamified interaction tailored for the Google Vibe Coding Competition.

---

## 2. Core User Journey (The "Sat-Set" Flow)
1. **Instant Onboarding (Zero Friction):** The user lands on a sleek onboarding screen and clicks **"Explore as Guest"**.
2. **Session Generation:** The system checks `localStorage` for an existing `vibecal_session_id` (UUID). If none exists, it generates one instantly. No emails, no passwords, no confirmation hooks.
3. **Workspace Entry:** The user is immediately redirected to their personal dashboard displaying a high-fidelity, fluid calendar canvas.
4. **Natural Language Input:** The user types an event description or clicks the microphone button to dictate an audio stream (e.g., *"Ntar malem jam 7 jangan lupa booking tempat mabar sama anak-anak"*).
5. **Real-time Rendering:** The input pipeline fires asynchronously, parses the intent via Gemini into a structured JSON payload, commits it to Supabase, and smoothly transitions the new event card onto the dashboard grid without triggering a page reload.

---

## 3. Tech Stack Architecture
*   **Front-End Canvas:** React.js or Next.js (SPA Architecture)
    *   *Styling:* Tailwind CSS + Radix UI / Shadcn UI components.
    *   *Calendar Rendering:* `@fullcalendar/react` (supporting timeGridDay, timeGridWeek, and dayGridMonth views).
    *   *Icons & Animations:* `lucide-react` for iconography, `framer-motion` for physics-based fluid UI micro-interactions.
*   **Back-End API Engine:** Node.js with Express (configured in a lightweight Docker container optimized for sub-second cold starts on Cloud Run).
*   **Database Tier:** **Supabase (PostgreSQL)**
    *   Leveraging cloud-native connection pooling.
*   **AI Orchestration:** Google Gen AI SDK (`@google/generative-ai`).
    *   *Model:* **Gemini 1.5 Flash** invoked with strict JSON Schema structural constraints.
*   **Audio Pipeline:** Web Audio API (Client-side) capturing WAV/WebM streams, paired with speech recognition APIs or back-end translation endpoints.

---

## 4. Comprehensive Database Schema
The database uses a clean, relational architecture hosted on Supabase PostgreSQL. For the MVP, a highly performant, indexed single-table paradigm manages data flow across concurrent guest instances.

### Table: `events`
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

-- Optimization indexes for sub-millisecond query isolation across concurrent sessions
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_time_range ON events(start_time, end_time);
```

### Data Categorization Matrix (`vibe_category` mapping):
1.  **Work (Neon Amethyst / Purple):** Meetings, deadlines, assignments, coding sessions.
2.  **Social (Sunset Coral / Pink-Orange):** Dinners, hangouts, dates, parties, gatherings.
3.  **Health (Vibrant Mint / Green):** Gym sessions, doctor appointments, meditation, sports.
4.  **Me-Time (Electric Cyan / Light Blue):** Gaming, movies, reading, personal hobbies.

---

## 5. System Components & Functional Requirements

### 5.1 Front-End Layer (UI/UX Canvas)
*   **Multi-View Viewport Toggle:** 
    *   Must feature an interactive, animated segment selector allowing users to switch dynamically between **Day (Harian)**, **Week (Mingguan)**, and **Month (Bulanan)** viewports.
    *   State changes across views must execute smoothly using `framer-motion` layout animations.
*   **Theme & Palette:** Neon Cyber-Minimalism. Rich, deep dark backgrounds (`#0d0e12`) contrasted with luminous, glow-accented event blocks matching their respective `vibe_category`.
*   **Quick-Action Prompt Cards:** Hover-sensitive cards pre-loaded with production test phrases:
    *   *Card 1:* "Meeting mingguan sama tim dev setiap senin jam 10 pagi"
    *   *Card 2:* "Nonton konser akhir pekan besok dari jam 5 sore sampe kelar"
    *   *Card 3:* "Gym benerin mood rabu subuh jam 5"
*   **Voice Transcription Interface:**
    *   A prominent, pulsing microphone action button.
    *   Captures audio via Web Audio API. Uses the browser's native `SpeechRecognition` API (or passes audio data directly to the backend) to generate high-fidelity text strings into the prompt bar.

### 5.2 Back-End Layer & AI Inference Pipeline
*   **Endpoint:** `POST /api/add-event`
*   **Payload Boundary:**
    ```json
    {
      "userId": "string (UUID from localstorage)",
      "prompt": "string (Text input or translated voice text)"
    }
    ```
*   **Gemini System Persona & Instruction Constraints:**
    The model must operate strictly as a structural parser mapping arbitrary natural language to ISO-compliant database fields.
    
    *System Instructions Passed to Gemini API:*
    ```text
    You are the structural brain of VibeCal. Process the user's Indonesian/English input.
    Extract the event intent and structure it exactly matching the JSON schema provided.
    
    Context Constraints:
    - Current Year Reference: 2026.
    - If the user specifies a day but omits the exact year/month, calculate the closest forward-looking date relative to the current calendar context.
    - If an end time is missing, automatically project a 1-hour duration from the start time.
    - Categorize into exactly one of these categories based on intent: 'Work', 'Social', 'Health', 'Me-Time'.
    ```

*   **Enforced Output JSON Schema Structure:**
    ```json
    {
      "type": "object",
      "properties": {
        "event_title": { "type": "string" },
        "start_date": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
        "start_time": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
        "end_time": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
        "vibe_category": { "type": "string", "enum": ["Work", "Social", "Health", "Me-Time"] }
      },
      "required": ["event_title", "start_date", "start_time", "end_time", "vibe_category"]
    }
    ```

*   **Database Ingestion Flow:**
    Upon extracting the structural JSON data, the backend constructs the unified `TIMESTAMP` string (`start_date + "T" + start_time`) and performs an atomic execution into the Supabase tables.

*   **Fetch Endpoint:** `GET /api/events?userId=<UUID>`
    Queries Supabase filtering exclusively by the requesting user's session identifier, ensuring zero data leakage between concurrent testers or judges.

---

## 6. Infrastructure & Deployment Specs (Google Cloud Run)
To achieve stateless scalability with guaranteed zero-cost inactivity windows, the execution environment must contain a production-grade Docker container configuration.

### `Dockerfile` Architecture:
```dockerfile
FROM node:18-alpine

# Optimize production environment execution variables
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Leverage container caching layers for dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bring over functional code modules
COPY . .

EXPOSE 8080

# Run using a non-root privileged user account for cloud security compliance
USER node

CMD ["node", "server.js"]
```

### Direct-to-Cloud Shell Execution Streamliner:
To build and push the image to Google Artifact Registry and instantiate the endpoint onto Cloud Run, the AI agent can execute the following build instructions:
```bash
# Build artifact and push instance setup
gcloud run deploy vibecal-backend \
    --source . \
    --allow-unauthenticated \
    --region asia-southeast1 \
    --port 8080 \
    --update-env-vars SUPABASE_URL=your_url,SUPABASE_KEY=your_key,GEMINI_API_KEY=your_key
```

---

## 7. Crucial Vibe Check Criteria (What Makes This a Winner)
1. **Dynamic Micro-Interactions:** When the JSON returns from the API, the target day cell on the calendar view should briefly glow with a pulse color corresponding to its category before rendering the card text.
2. **Robust Slang Parsing:** The backend must smoothly intercept highly unstructured phrases like *"Ntar malem cabut kemana ke senopati jam 8"*, turning it accurately into a `Social` category block from `20:00` to `21:00`.
3. **No Empty States:** If a user switches to a view with no events logged, show a quirky, fun placeholder text like *"Jadwal kamu kosong melompong. Ketik sesuatu di bawah biar keliatan sibuk!"* rather than a blank white box.
