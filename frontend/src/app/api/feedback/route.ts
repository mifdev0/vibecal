import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server-utils';

// GET all feedback
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('feedback_forum')
      .select(`
        *,
        author:users_custom(full_name, username, profile_picture, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || [], { status: 200 });
  } catch (error: any) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback', details: error.message }, { status: 500 });
  }
}

// POST new feedback
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, title, description, category, image_url } = body;

    if (!userId || !title || !description || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('feedback_forum')
      .insert({
        user_id: userId,
        title,
        description,
        category,
        image_url: image_url || null,
        comments: []
      })
      .select(`
        *,
        author:users_custom(full_name, username, profile_picture, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: 'success',
      feedback: data
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating feedback:', error);
    return NextResponse.json({ error: 'Failed to create feedback', details: error.message }, { status: 500 });
  }
}
