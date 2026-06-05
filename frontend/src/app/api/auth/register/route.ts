import { NextResponse } from 'next/server';
import { supabase, hashPassword } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, email, username, password } = body;

    if (!full_name || !email || !username || !password) {
      return NextResponse.json({ error: 'Semua field harus diisi' }, { status: 400 });
    }

    // 1. Check if email already exists in Supabase users_custom
    const { data: emailExists, error: emailErr } = await supabase
      .from('users_custom')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (emailErr) throw emailErr;
    if (emailExists) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }

    // 2. Check if username already exists in Supabase users_custom
    const { data: usernameExists, error: usernameErr } = await supabase
      .from('users_custom')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (usernameErr) throw usernameErr;
    if (usernameExists) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 });
    }

    // 3. Hash password and insert
    const { salt, hash } = hashPassword(password);
    
    const { data: newUser, error: insertErr } = await supabase
      .from('users_custom')
      .insert({
        full_name,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password_hash: hash,
        salt,
      })
      .select('id, full_name, email, username')
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      status: 'success',
      user: newUser,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error during registration:', error);
    return NextResponse.json({ error: 'Registrasi gagal', details: error.message }, { status: 500 });
  }
}
