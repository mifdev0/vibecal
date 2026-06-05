import { NextResponse } from 'next/server';
import { supabase, verifyPassword } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Username/Email dan Password harus diisi' }, { status: 400 });
    }

    // Search by email or username
    const isEmail = identifier.includes('@');
    const query = supabase
      .from('users_custom')
      .select('id, full_name, email, username, password_hash, salt');

    const { data: user, error } = isEmail 
      ? await query.eq('email', identifier.toLowerCase()).maybeSingle()
      : await query.eq('username', identifier.toLowerCase()).maybeSingle();

    if (error) throw error;
    if (!user) {
      return NextResponse.json({ error: 'Username atau Email tidak ditemukan' }, { status: 400 });
    }

    const isValid = verifyPassword(password, user.salt, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 400 });
    }

    return NextResponse.json({
      status: 'success',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        username: user.username,
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Login gagal', details: error.message }, { status: 500 });
  }
}
