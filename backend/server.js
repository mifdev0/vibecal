const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Polyfill WebSocket for Node.js < 22 (required for Supabase Realtime)
global.WebSocket = WebSocket;

// Users Local File Database Setup
const USERS_FILE = path.join(__dirname, 'users.json');

const readUsers = () => {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
};

const writeUsers = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error writing users file:', err);
  }
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, salt, hash) => {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};


const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Groq Setup
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
You are the structural brain of VibeCal, a premium personal AI planner.
Process the user's Indonesian/English input.
Analyze the user's request and the list of currently existing calendar events, and return the actions needed (add, update, delete) exactly matching the JSON schema provided.

Context Constraints:
- Current Year Reference: {currentYear}
- Today's Reference Date: {currentDate} ({dayOfWeek})
- User's Local Time: {localTime}
- If the user specifies a day but omits the exact year/month, calculate the closest forward-looking date relative to the user's current calendar context.
- If an end time is missing, automatically project a 1-hour duration from the start time.
- Categorize into exactly one of these categories based on intent: 'Work', 'Social', 'Health', 'Me-Time'.
- RECURRING EVENTS: If the user requests a recurring schedule (e.g., "setiap hari", "setiap senin dan rabu"), calculate and generate ALL individual occurrences for the next 30 days starting from today (or until the end of the specified calendar month if they explicitly request a specific month like "di bulan Juni ini"). Return them as separate objects in the "actions.add" array. Do not miss any occurrences!
- INDONESIAN COLLOQUIAL TIME PHRASES (CRITICAL FOR DATE RESOLUTION):
  * "Malam Minggu" refers specifically to SATURDAY NIGHT (Sabtu malam), NOT Sunday night (malam setelah hari Minggu).
  * "Malam Senin" is Sunday night, "Malam Selasa" is Monday night, and so on.
  * Phrases like "Sabtu besok", "Minggu besok", or "Malam Minggu besok/nanti" refer to the UPCOMING nearest Saturday or Sunday relative to today's date, NOT literally the next calendar day (tomorrow) unless today is indeed Friday. For example, if today is Tuesday, June 2, "malam minggu besok" refers to Saturday, June 6, NOT Wednesday, June 3.
  * "Besok" on its own means tomorrow, but when combined with a day name ("Malam Minggu besok"), the day name ("Malam Minggu" = Saturday night) takes absolute precedence for date calculation.
- OPTIONAL LOCATION: Extract the place/location if specified by the user (e.g. "di Grand Indonesia", "at office", "ke Resto"). Place it in the "location" field. This is OPTIONAL; if not mentioned, return it as an empty string. DO NOT ask for clarification or set status to "needs_clarification" if the location is missing.

VALIDATION & CONVERSATION RULES (VERY IMPORTANT FOR EFFICIENCY):
1. If the user's request is incomplete (e.g., missing the name of the activity, missing what day/date it is, missing the start time, or missing duration/end time):
   - Set "status" to "needs_clarification".
   - Set "message" to a VERY BRIEF, CONCISE, AND DIRECT question in {language} asking ONLY for the specific missing detail (e.g., in ID: "Gym besok mau jam berapa & berapa lama?" or in EN: "Gym tomorrow at what time & for how long?").
   - CRITICAL: The question in the "message" field MUST be completely in {language}. All dialog must be in {language}!
   - CRITICAL: JANGAN bertele-tele! JANGAN menggunakan kalimat pembuka/basa-basi (e.g., "Tentu...", "Baik, untuk...", "Halo!"). Langsung ke inti pertanyaan dengan maksimal 5-8 kata!
   - CRITICAL: JANGAN PERNAH menanyakan kembali detail (nama kegiatan, tanggal, jam) yang sudah pernah disebutkan oleh pengguna di pesan-pesan sebelumnya dalam riwayat obrolan (chatHistory).
   - Bacalah seluruh riwayat pesan sebelumnya dengan sangat teliti untuk merangkai detail. Jika user menjawab pertanyaan klarifikasi (misalnya user menjawab "Jam 4 sore"), hubungkan jawaban ini dengan kegiatan ("Gym") dan tanggal ("besok") dari pesan pertama mereka di riwayat obrolan. JANGAN tanyakan lagi "kegiatan apa"!
   - Keep "actions.add", "actions.update", and "actions.delete" as empty arrays.
2. If the user's request is complete and has all necessary fields:
   - Set "status" to "success".
   - Set "message" to "Jadwal berhasil ditambahkan!" (if language is Indonesian) or "Schedule successfully added!" (if language is English).
   - Populate "actions" according to the ACTION MAPPING GUIDELINES.

ACTION MAPPING GUIDELINES:
1. ADD: Use "add" for creating new events. Place them in "actions.add".
2. UPDATE: If the user wants to edit, reschedule, or move an existing event, identify the event in the provided list by its "id", and place the updated properties in "actions.update", specifying its "id".
3. DELETE: If the user wants to cancel, remove, or delete an existing event, identify the event in the provided list by its "id" and place the "id" in the "actions.delete" array.

JSON Schema Structure:
{
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["success", "needs_clarification"] },
    "message": { "type": "string" },
    "actions": {
      "type": "object",
      "properties": {
        "add": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "event_title": { "type": "string" },
              "location": { "type": "string" },
              "start_date": { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$" },
              "start_time": { "type": "string", "pattern": "^\\\\d{2}:\\\\d{2}$" },
              "end_time": { "type": "string", "pattern": "^\\\\d{2}:\\\\d{2}$" },
              "vibe_category": { "type": "string", "enum": ["Work", "Social", "Health", "Me-Time"] }
            },
            "required": ["event_title", "start_date", "start_time", "end_time", "vibe_category"]
          }
        },
        "update": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": ["integer", "string"] },
              "event_title": { "type": "string" },
              "location": { "type": "string" },
              "start_date": { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$" },
              "start_time": { "type": "string", "pattern": "^\\\\d{2}:\\\\d{2}$" },
              "end_time": { "type": "string", "pattern": "^\\\\d{2}:\\\\d{2}$" },
              "vibe_category": { "type": "string", "enum": ["Work", "Social", "Health", "Me-Time"] }
            },
            "required": ["id", "event_title", "start_date", "start_time", "end_time", "vibe_category"]
          }
        },
        "delete": {
          "type": "array",
          "items": { "type": ["integer", "string"] }
        }
      },
      "required": ["add", "update", "delete"]
    }
  },
  "required": ["status", "message", "actions"]
}
`;

// Routes
// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { full_name, email, username, password } = req.body;
  if (!full_name || !email || !username || !password) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  const users = readUsers();
  
  // Check if email already exists
  const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (emailExists) {
    return res.status(400).json({ error: 'Email sudah terdaftar' });
  }

  // Check if username already exists
  const usernameExists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (usernameExists) {
    return res.status(400).json({ error: 'Username sudah digunakan' });
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id: crypto.randomUUID(),
    full_name,
    email,
    username,
    password_hash: hash,
    salt,
    created_at: new Date().toISOString()
  };

  users.push(newUser);
  writeUsers(users);

  res.status(201).json({
    status: 'success',
    user: {
      id: newUser.id,
      full_name: newUser.full_name,
      email: newUser.email,
      username: newUser.username
    }
  });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email dan Password harus diisi' });
  }

  const users = readUsers();
  const user = users.find(u => 
    u.email.toLowerCase() === identifier.toLowerCase() || 
    u.username.toLowerCase() === identifier.toLowerCase()
  );

  if (!user) {
    return res.status(400).json({ error: 'Username atau Email tidak ditemukan' });
  }

  const isValid = verifyPassword(password, user.salt, user.password_hash);
  if (!isValid) {
    return res.status(400).json({ error: 'Password salah' });
  }

  res.status(200).json({
    status: 'success',
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      username: user.username
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// GET /api/events?userId=<UUID>
app.get('/api/events', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/add-event
app.post('/api/add-event', async (req, res) => {
  const { userId, prompt, chatHistory, currentDate, dayOfWeek, localTime, timezoneOffset, lang } = req.body;
  
  if (!userId || !prompt) {
    return res.status(400).json({ error: 'userId and prompt are required' });
  }

  try {
    // 1. Fetch existing calendar events for the user to pass as context
    const { data: existingEvents, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr) throw fetchErr;

    const existingEventsContext = existingEvents.map(e => ({
      id: e.id,
      title: e.title,
      start_time: e.start_time,
      end_time: e.end_time,
      vibe_category: e.vibe_category
    }));

    // Substitute client real-time parameters dynamically
    const clientYear = currentDate ? currentDate.split('-')[0] : '2026';
    const targetLanguage = lang === 'en' ? 'English' : 'Indonesian';
    const finalSystemInstruction = SYSTEM_INSTRUCTION
      .replace('{currentYear}', clientYear)
      .replace('{currentDate}', currentDate || new Date().toISOString().split('T')[0])
      .replace('{dayOfWeek}', dayOfWeek || 'Monday')
      .replace('{localTime}', localTime || '00:00')
      .replace(/{language}/g, targetLanguage);

    // 2. AI Inference with Groq (Llama 3.3 70B Versatile)
    const messages = [
      { role: 'system', content: finalSystemInstruction }
    ];

    if (existingEventsContext && existingEventsContext.length > 0) {
      messages.push({
        role: 'system',
        content: `Here is the list of existing events currently in the calendar:\n${JSON.stringify(existingEventsContext, null, 2)}`
      });
    }

    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }
    // Always append the current user prompt at the end of the history
    messages.push({ role: 'user', content: prompt });

    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' }
    });
    
    const jsonString = chatCompletion.choices[0].message.content;
    
    // Robust JSON extraction
    let cleanText = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleanText = cleanText.substring(startIdx, endIdx + 1);
    }
    const eventData = JSON.parse(cleanText);

    if (!eventData.status || !eventData.message) {
      throw new Error('AI did not return a valid status and message block.');
    }

    const offset = timezoneOffset || 'Z'; // Offset string like '+07:00'

    // If status is needs_clarification, return early without saving any DB actions
    if (eventData.status === 'needs_clarification') {
      return res.status(200).json({
        status: 'needs_clarification',
        message: eventData.message,
        events: []
      });
    }

    // Otherwise, it is a success! Execute the actions:
    
    // 3. Process DELETE Actions
    if (eventData.actions.delete && Array.isArray(eventData.actions.delete) && eventData.actions.delete.length > 0) {
      const { error: delErr } = await supabase
        .from('events')
        .delete()
        .in('id', eventData.actions.delete)
        .eq('user_id', userId);
      
      if (delErr) throw delErr;
    }

    // 4. Process UPDATE Actions
    if (eventData.actions.update && Array.isArray(eventData.actions.update) && eventData.actions.update.length > 0) {
      for (const item of eventData.actions.update) {
        let loc = item.location || '';
        if (loc) {
          loc = loc.replace(/^[(\s📍\u{1F4CD}]+|[)\s]+$/gu, '').trim();
        }
        const { error: updErr } = await supabase
          .from('events')
          .update({
            title: loc ? `${item.event_title} || ${loc}` : item.event_title,
            start_time: `${item.start_date}T${item.start_time}:00${offset}`,
            end_time: `${item.start_date}T${item.end_time}:00${offset}`,
            vibe_category: item.vibe_category,
            raw_prompt: prompt
          })
          .eq('id', item.id)
          .eq('user_id', userId);

        if (updErr) throw updErr;
      }
    }

    // 5. Process ADD Actions
    if (eventData.actions.add && Array.isArray(eventData.actions.add) && eventData.actions.add.length > 0) {
      const dbPayloads = eventData.actions.add.map(event => {
        let loc = event.location || '';
        if (loc) {
          loc = loc.replace(/^[(\s📍\u{1F4CD}]+|[)\s]+$/gu, '').trim();
        }
        return {
          user_id: userId,
          title: loc ? `${event.event_title} || ${loc}` : event.event_title,
          start_time: `${event.start_date}T${event.start_time}:00${offset}`,
          end_time: `${event.start_date}T${event.end_time}:00${offset}`,
          vibe_category: event.vibe_category,
          raw_prompt: prompt
        };
      });

      const { error: addErr } = await supabase
        .from('events')
        .insert(dbPayloads);

      if (addErr) throw addErr;
    }

    // 6. Refetch all events to return the fully updated state to the client
    const { data: updatedEvents, error: refetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (refetchErr) throw refetchErr;

    res.status(201).json({
      status: 'success',
      message: eventData.message,
      events: updatedEvents
    });
  } catch (error) {
    console.error('Error adding/updating event actions:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/upload-schedule
app.post('/api/upload-schedule', async (req, res) => {
  const { userId, image, file, currentDate, dayOfWeek, localTime, timezoneOffset } = req.body;
  const fileData = file || image;

  if (!userId || !fileData) {
    return res.status(400).json({ error: 'userId and file/image are required' });
  }

  try {
    // 1. Parse base64 file data
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 file format' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const clientYear = currentDate ? currentDate.split('-')[0] : '2026';
    const clientDateStr = currentDate || new Date().toISOString().split('T')[0];
    const clientDayOfWeek = dayOfWeek || 'Monday';
    const clientLocalTime = localTime || '00:00';

    const prompt = `
You are the structural brain of VibeCal. Analyze this schedule file (e.g., an internship roster, study timetable, exam calendar, shift list, or document).
Extract all scheduled events and parse their titles, dates, start times, and end times.

Context Constraints:
- Current Year Reference: ${clientYear}
- Today's Reference Date: ${clientDateStr} (${clientDayOfWeek})
- User's Local Time: ${clientLocalTime}
- Calculate correct dates relative to the context date if only day names or day numbers are given in the schedule.
- If an end time is missing, automatically project a 1-hour duration from the start time.
- Categorize into exactly one of these categories based on intent: 'Work', 'Social', 'Health', 'Me-Time'. (Tip: Internship/Magang should be categorized as 'Work').

Format the response exactly as a JSON matching this schema:
{
  "events": [
    {
      "event_title": "string",
      "start_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "vibe_category": "Work | Social | Health | Me-Time"
    }
  ]
}

Output ONLY valid JSON. Do not wrap it in markdown or add explanations.
`;

    let eventData;

    // Check mimeType and branch parsing logic
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      // PDF or Image - Natively supported by Gemini 1.5 Flash
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const filePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };

      const result = await model.generateContent([prompt, filePart]);
      const responseText = result.response.text();
      
      // Robust JSON extraction and parsing
      let cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const startIdx = cleanText.indexOf('{');
      const endIdx = cleanText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanText = cleanText.substring(startIdx, endIdx + 1);
      }
      eventData = JSON.parse(cleanText);
    } 
    else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      mimeType === 'application/msword'
    ) {
      // Word Document (.docx / .doc) - Extract text first, then pass to Gemini
      const mammoth = require('mammoth');
      const buffer = Buffer.from(base64Data, 'base64');
      const textResult = await mammoth.extractRawText({ buffer: buffer });
      const extractedText = textResult.value;

      if (!extractedText.trim()) {
        throw new Error('Dokumen Word kosong atau tidak dapat dibaca.');
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const textPrompt = `
${prompt}

Here is the text content extracted from the Word document:
"""
${extractedText}
"""
`;
      const result = await model.generateContent([textPrompt]);
      const responseText = result.response.text();
      
      // Robust JSON extraction and parsing
      let cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const startIdx = cleanText.indexOf('{');
      const endIdx = cleanText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanText = cleanText.substring(startIdx, endIdx + 1);
      }
      eventData = JSON.parse(cleanText);
    }
    else {
      return res.status(400).json({ error: 'Format file tidak didukung. Harap unggah Gambar, PDF, atau Word (.docx).' });
    }

    // Resilient events breakdown mapping
    let eventsList = [];
    if (eventData.events && Array.isArray(eventData.events)) {
      eventsList = eventData.events;
    } else if (Array.isArray(eventData)) {
      eventsList = eventData;
    } else if (eventData.event_title) {
      eventsList = [eventData];
    } else {
      throw new Error('AI did not return a valid events list.');
    }

    const offset = timezoneOffset || 'Z';

    // 3. Transform to Supabase database payload
    const dbPayloads = eventsList.map(event => ({
      user_id: userId,
      title: event.event_title,
      start_time: `${event.start_date}T${event.start_time}:00${offset}`,
      end_time: `${event.start_date}T${event.end_time}:00${offset}`,
      vibe_category: event.vibe_category,
      raw_prompt: `[File Uploaded: ${mimeType}]`
    }));

    // 4. Ingest into Supabase
    const { data, error } = await supabase
      .from('events')
      .insert(dbPayloads)
      .select();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error processing schedule file:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`VibeCal Backend listening at http://localhost:${port}`);
});
