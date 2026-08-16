import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server-utils';
import crypto from 'crypto';

// Helper to hydrate comments with latest user profiles
async function hydrateComments(rawComments: any[]) {
  if (!Array.isArray(rawComments) || rawComments.length === 0) return [];

  const userIds = Array.from(new Set(rawComments.map(c => c.user_id).filter(Boolean)));
  if (userIds.length === 0) return rawComments;

  const { data: users } = await supabase
    .from('users_custom')
    .select('id, full_name, username, profile_picture, email')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  if (users) {
    users.forEach(u => {
      userMap[u.id] = u;
    });
  }

  return rawComments.map(c => {
    const latestUser = userMap[c.user_id];
    return {
      ...c,
      user_name: latestUser?.full_name || c.user_name,
      username: latestUser?.username || c.username,
      profile_picture: latestUser !== undefined ? latestUser.profile_picture : c.profile_picture,
      is_developer: latestUser ? (latestUser.email?.toLowerCase() === 'mifthahulamri@gmail.com') : c.is_developer
    };
  });
}

export async function POST(request: Request) {
  try {
    const { feedbackId, userId, content } = await request.json();

    if (!feedbackId || !userId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get user details
    const { data: user, error: userErr } = await supabase
      .from('users_custom')
      .select('full_name, username, profile_picture, email')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const isDeveloper = user.email.toLowerCase() === 'mifthahulamri@gmail.com';

    // 2. Fetch current comments
    const { data: post, error: postErr } = await supabase
      .from('feedback_forum')
      .select('comments')
      .eq('id', feedbackId)
      .maybeSingle();

    if (postErr) throw postErr;
    if (!post) {
      return NextResponse.json({ error: 'Post feedback tidak ditemukan' }, { status: 404 });
    }

    const currentComments = Array.isArray(post.comments) ? post.comments : [];

    const newComment = {
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: user.full_name,
      username: user.username,
      profile_picture: user.profile_picture || null,
      content,
      is_developer: isDeveloper,
      created_at: new Date().toISOString()
    };

    const updatedComments = [...currentComments, newComment];

    // 3. Update comments in database
    const { error: updateErr } = await supabase
      .from('feedback_forum')
      .update({ comments: updatedComments })
      .eq('id', feedbackId);

    if (updateErr) throw updateErr;

    const hydratedComments = await hydrateComments(updatedComments);

    return NextResponse.json({
      status: 'success',
      comments: hydratedComments
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Gagal menambahkan komentar', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');
    const commentId = searchParams.get('commentId');
    const userId = searchParams.get('userId');

    if (!feedbackId || !commentId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Get user details to check developer status
    const { data: user, error: userErr } = await supabase
      .from('users_custom')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;
    const isDeveloper = user?.email?.toLowerCase() === 'mifthahulamri@gmail.com';

    // 2. Fetch feedback comments
    const { data: post, error: postErr } = await supabase
      .from('feedback_forum')
      .select('comments')
      .eq('id', feedbackId)
      .maybeSingle();

    if (postErr) throw postErr;
    if (!post) {
      return NextResponse.json({ error: 'Post feedback tidak ditemukan' }, { status: 404 });
    }

    const currentComments = Array.isArray(post.comments) ? post.comments : [];
    const commentToDelete = currentComments.find((c: any) => c.id === commentId);

    if (!commentToDelete) {
      return NextResponse.json({ error: 'Komentar tidak ditemukan' }, { status: 404 });
    }

    // Only owner of the comment or developer can delete
    if (commentToDelete.user_id !== userId && !isDeveloper) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus komentar ini' }, { status: 403 });
    }

    const updatedComments = currentComments.filter((c: any) => c.id !== commentId);

    // 3. Update database
    const { error: updateErr } = await supabase
      .from('feedback_forum')
      .update({ comments: updatedComments })
      .eq('id', feedbackId);

    if (updateErr) throw updateErr;

    const hydratedComments = await hydrateComments(updatedComments);

    return NextResponse.json({
      status: 'success',
      comments: hydratedComments
    });

  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Gagal menghapus komentar', details: error.message }, { status: 500 });
  }
}

