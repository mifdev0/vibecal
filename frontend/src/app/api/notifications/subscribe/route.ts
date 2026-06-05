import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, subscription } = body;

    if (!userId || !subscription) {
      return NextResponse.json({ error: 'userId and subscription are required' }, { status: 400 });
    }

    const endpoint = subscription.endpoint;

    // Check if subscription with this endpoint already exists
    const { data: existing, error: queryErr } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('subscription->>endpoint', endpoint)
      .maybeSingle();

    if (queryErr) throw queryErr;

    if (existing) {
      // Update user_id or subscription details
      const { error: updateErr } = await supabase
        .from('push_subscriptions')
        .update({
          user_id: userId,
          subscription: subscription,
        })
        .eq('id', existing.id);

      if (updateErr) throw updateErr;
    } else {
      // Insert new subscription
      const { error: insertErr } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          subscription: subscription,
        });

      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving subscription:', error);
    return NextResponse.json({ error: 'Gagal menyimpan subscription', details: error.message }, { status: 500 });
  }
}
