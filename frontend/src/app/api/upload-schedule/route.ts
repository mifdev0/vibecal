import { NextResponse } from 'next/server';
import { supabase, genAI } from '@/lib/server-utils';
import mammoth from 'mammoth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, image, file, currentDate, dayOfWeek, localTime, timezoneOffset } = body;
    const fileData = file || image;

    if (!userId || !fileData) {
      return NextResponse.json({ error: 'userId and file/image are required' }, { status: 400 });
    }

    // 1. Parse base64 file data
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid base64 file format' }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const clientYear = currentDate ? currentDate.split('-')[0] : '2026';
    const clientDateStr = currentDate || new Date().toISOString().split('T')[0];
    const clientDayOfWeek = dayOfWeek || 'Monday';
    const clientLocalTime = localTime || '00:00';

    const prompt = `
You are the structural brain of VibeCal. Analyze this schedule file (e.g., an internship roster, study 
timetable, exam calendar, shift list, or document).
Extract all scheduled events and parse their titles, dates, start times, and end times.

Context Constraints:
- Current Year Reference: ${clientYear}
- Today's Reference Date: ${clientDateStr} (${clientDayOfWeek})
- User's Local Time: ${clientLocalTime}
- Calculate correct dates relative to the context date if only day names or day numbers are given in the 
schedule.
- If an end time is missing, automatically project a 1-hour duration from the start time.
- Categorize into exactly one of these categories based on intent: 'Work', 'Social', 'Health', 'Me-Time'. (Tip: 
Internship/Magang should be categorized as 'Work').

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
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah Gambar, PDF, atau Word (.docx).' }, { status: 400 });
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
    const dbPayloads = eventsList.map((event: any) => ({
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

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error processing schedule file:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
