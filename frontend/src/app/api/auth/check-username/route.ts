import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const { username, currentUserId } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Check if username exists in users_custom, ignoring the current user
    let query = supabase
      .from('users_custom')
      .select('id')
      .eq('username', username.toLowerCase().trim());

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      available: !data,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error checking username:', error);
    return NextResponse.json({ error: 'Failed to check username', details: error.message }, { status: 500 });
  }
}
