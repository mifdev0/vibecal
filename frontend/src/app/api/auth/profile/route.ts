import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('users_custom')
      .select('id, full_name, email, username, profile_picture')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'success',
      user
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile', details: error.message }, { status: 500 });
  }
}
