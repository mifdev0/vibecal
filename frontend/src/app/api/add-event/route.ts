import { NextResponse } from 'next/server';
import { supabase, groq, SYSTEM_INSTRUCTION } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, prompt, chatHistory, currentDate, dayOfWeek, localTime, timezoneOffset, lang } = body;

    if (!userId || !prompt) {
      return NextResponse.json({ error: 'userId and prompt are required' }, { status: 400 });
    }

    // 1. Fetch existing calendar events for the user to pass as context
    const { data: existingEvents, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr) throw fetchErr;

    const existingEventsContext = existingEvents.map((e: any) => ({
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
    const messages: any[] = [
      { role: 'system', content: finalSystemInstruction }
    ];

    if (existingEventsContext && existingEventsContext.length > 0) {
      messages.push({
        role: 'system',
        content: `Here is the list of existing events currently in the calendar:\n${JSON.stringify(existingEventsContext, null, 2)}`
      });
    }

    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
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
    if (!jsonString) {
      throw new Error('AI returned an empty response.');
    }
    
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
      return NextResponse.json({
        status: 'needs_clarification',
        message: eventData.message,
        events: []
      }, { status: 200 });
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
        const updatePayload: any = {};

        if (item.event_title !== undefined) {
          let loc = item.location || '';
          if (loc) {
            loc = loc.replace(/^[(\s📍\u{1F4CD}]+|[)\s]+$/gu, '').trim();
          }
          updatePayload.title = loc ? `${item.event_title} || ${loc}` : item.event_title;
        } else if (item.location !== undefined) {
          // If only location is updated, fetch current title to append it
          const { data: currentEvent } = await supabase
            .from('events')
            .select('title')
            .eq('id', item.id)
            .maybeSingle();
          if (currentEvent) {
            const currentTitlePart = currentEvent.title.split(' || ')[0];
            let loc = item.location;
            if (loc) {
              loc = loc.replace(/^[(\s📍\u{1F4CD}]+|[)\s]+$/gu, '').trim();
            }
            updatePayload.title = loc ? `${currentTitlePart} || ${loc}` : currentTitlePart;
          }
        }

        if (item.start_date !== undefined && item.start_time !== undefined) {
          updatePayload.start_time = `${item.start_date}T${item.start_time}:00${offset}`;
        }
        if (item.start_date !== undefined && item.end_time !== undefined) {
          updatePayload.end_time = `${item.start_date}T${item.end_time}:00${offset}`;
        }
        if (item.vibe_category !== undefined) {
          updatePayload.vibe_category = item.vibe_category;
        }
        if (item.reminder_offset !== undefined) {
          updatePayload.reminder_offset = item.reminder_offset;
          updatePayload.notified = false; // Reset notified state so they can receive updates
        }

        updatePayload.raw_prompt = prompt;

        let { error: updErr } = await supabase
          .from('events')
          .update(updatePayload)
          .eq('id', item.id)
          .eq('user_id', userId);

        if (updErr) {
          // Resilient fallback: if columns do not exist in the DB (Postgres 42703), strip them and retry
          if (updErr.code === '42703' || updErr.message.includes('reminder_offset') || updErr.message.includes('notified')) {
            const { reminder_offset, notified, ...fallbackPayload } = updatePayload;
            if (Object.keys(fallbackPayload).length > 0) {
              const { error: fallbackErr } = await supabase
                .from('events')
                .update(fallbackPayload)
                .eq('id', item.id)
                .eq('user_id', userId);
              updErr = fallbackErr;
            } else {
              updErr = null; // No other changes to apply
            }
          }
        }

        if (updErr) throw updErr;
      }
    }

    // 5. Process ADD Actions
    if (eventData.actions.add && Array.isArray(eventData.actions.add) && eventData.actions.add.length > 0) {
      const dbPayloads = eventData.actions.add.map((event: any) => {
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
          reminder_offset: event.reminder_offset !== undefined ? event.reminder_offset : 15,
          notified: false,
          raw_prompt: prompt
        };
      });

      let { error: addErr } = await supabase
        .from('events')
        .insert(dbPayloads);

      if (addErr) {
        // Resilient fallback: if columns do not exist in the DB (Postgres 42703), strip them and retry
        if (addErr.code === '42703' || addErr.message.includes('reminder_offset') || addErr.message.includes('notified')) {
          const fallbackPayloads = dbPayloads.map(({ reminder_offset, notified, ...rest }: any) => rest);
          const { error: fallbackErr } = await supabase
            .from('events')
            .insert(fallbackPayloads);
          addErr = fallbackErr;
        }
      }

      if (addErr) throw addErr;
    }

    // 6. Refetch all events to return the fully updated state to the client
    const { data: updatedEvents, error: refetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (refetchErr) throw refetchErr;

    return NextResponse.json({
      status: 'success',
      message: eventData.message,
      events: updatedEvents
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error adding/updating event actions:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
