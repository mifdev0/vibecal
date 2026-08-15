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

// PUT (edit) feedback
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { feedbackId, userId, title, description, category, image_url } = body;

    if (!feedbackId || !userId || !title || !description || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify ownership
    const { data: feedback, error: fbErr } = await supabase
      .from('feedback_forum')
      .select('user_id')
      .eq('id', feedbackId)
      .maybeSingle();

    if (fbErr) throw fbErr;
    if (!feedback) {
      return NextResponse.json({ error: 'Post tidak ditemukan' }, { status: 404 });
    }

    if (feedback.user_id !== userId) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengedit post ini' }, { status: 403 });
    }

    // 2. Update post
    const { data: updated, error: updErr } = await supabase
      .from('feedback_forum')
      .update({
        title,
        description,
        category,
        image_url: image_url === undefined ? undefined : image_url
      })
      .eq('id', feedbackId)
      .select(`
        *,
        author:users_custom(full_name, username, profile_picture, email)
      `)
      .single();

    if (updErr) throw updErr;

    return NextResponse.json({
      status: 'success',
      feedback: updated
    });
  } catch (error: any) {
    console.error('Error updating feedback:', error);
    return NextResponse.json({ error: 'Gagal mengedit post', details: error.message }, { status: 500 });
  }
}

// DELETE feedback
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');
    const userId = searchParams.get('userId');

    if (!feedbackId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Get user to check developer status
    const { data: user, error: userErr } = await supabase
      .from('users_custom')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;

    const isDeveloper = user?.email?.toLowerCase() === 'mifthahulamri@gmail.com';

    // 2. Fetch feedback post to verify ownership
    const { data: feedback, error: fbErr } = await supabase
      .from('feedback_forum')
      .select('user_id')
      .eq('id', feedbackId)
      .maybeSingle();

    if (fbErr) throw fbErr;
    if (!feedback) {
      return NextResponse.json({ error: 'Post tidak ditemukan' }, { status: 404 });
    }

    // Only author or developer can delete
    if (feedback.user_id !== userId && !isDeveloper) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus post ini' }, { status: 403 });
    }

    const { error: delErr } = await supabase
      .from('feedback_forum')
      .delete()
      .eq('id', feedbackId);

    if (delErr) throw delErr;

    return NextResponse.json({ status: 'success', message: 'Post berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ error: 'Gagal menghapus post', details: error.message }, { status: 500 });
  }
}

