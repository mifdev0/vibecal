import { NextResponse } from 'next/server';
import { supabase, hashPassword, verifyPassword } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, full_name, username, profile_picture, current_password, new_password } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch current user data from database
    const { data: user, error: fetchErr } = await supabase
      .from('users_custom')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const updateData: any = {};

    // 2. Handle username change (check uniqueness)
    if (username && username.toLowerCase().trim() !== user.username) {
      const cleanUsername = username.toLowerCase().trim();
      const { data: exists, error: checkErr } = await supabase
        .from('users_custom')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', userId)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (exists) {
        return NextResponse.json({ error: 'Username sudah digunakan oleh orang lain' }, { status: 400 });
      }
      updateData.username = cleanUsername;
    }

    // 3. Handle full name change
    if (full_name && full_name.trim() !== user.full_name) {
      updateData.full_name = full_name.trim();
    }

    // 4. Handle profile picture change
    if (profile_picture !== undefined) {
      updateData.profile_picture = profile_picture;
    }

    // 5. Handle password change
    if (new_password) {
      if (!current_password) {
        return NextResponse.json({ error: 'Password saat ini harus diisi untuk mengganti password' }, { status: 400 });
      }

      const isCurrentValid = verifyPassword(current_password, user.salt, user.password_hash);
      if (!isCurrentValid) {
        return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
      }

      const { salt, hash } = hashPassword(new_password);
      updateData.salt = salt;
      updateData.password_hash = hash;
    }

    // If nothing to update, return early
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'Tidak ada perubahan',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          username: user.username,
          profile_picture: user.profile_picture,
        }
      });
    }

    // 6. Update database
    const { data: updatedUser, error: updateErr } = await supabase
      .from('users_custom')
      .update(updateData)
      .eq('id', userId)
      .select('id, full_name, email, username, profile_picture')
      .single();

    if (updateErr) {
      // Handle the case where profile_picture column does not exist yet
      if (updateErr.message.includes('profile_picture') || updateErr.code === '42703') {
        return NextResponse.json({
          error: 'Kolom profile_picture belum ada di database. Silakan jalankan ALTER TABLE di Supabase.',
          code: 'MISSING_COLUMN'
        }, { status: 500 });
      }
      throw updateErr;
    }

    return NextResponse.json({
      status: 'success',
      message: 'Profil berhasil diperbarui',
      user: updatedUser
    });

  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Gagal memperbarui profil', details: error.message }, { status: 500 });
  }
}
