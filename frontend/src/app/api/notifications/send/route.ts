import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server-utils';
import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:support@vibecal.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);

    // 1. Fetch events starting in the next 15 minutes that haven't been notified yet
    const { data: upcomingEvents, error: eventsErr } = await supabase
      .from('events')
      .select('*')
      .gte('start_time', now.toISOString())
      .lte('start_time', fifteenMinsLater.toISOString())
      .or('notified.eq.false,notified.is.null');

    if (eventsErr) throw eventsErr;

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return NextResponse.json({ message: 'No upcoming events to notify' }, { status: 200 });
    }

    let notificationsSentCount = 0;

    for (const event of upcomingEvents) {
      // 2. Fetch push subscriptions for this user
      const { data: subscriptions, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', event.user_id);

      if (subErr) {
        console.error(`Error fetching subscriptions for user ${event.user_id}:`, subErr);
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        // Mark as notified so we don't check it again next time
        await supabase
          .from('events')
          .update({ notified: true })
          .eq('id', event.id);
        continue;
      }

      // Format time politely
      const eventTime = new Date(event.start_time).toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });

      const payload = JSON.stringify({
        title: `Ingat Jadwal: ${event.title}`,
        body: `Agenda "${event.title}" akan dimulai pukul ${eventTime}${event.location ? ` di ${event.location}` : ''}.`,
        url: '/',
        tag: `event-${event.id}`,
      });

      // Send push to all registered devices of the user
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            sub.subscription,
            payload
          );
          notificationsSentCount++;
        } catch (pushErr: any) {
          console.error(`Push notification failed for subscription ${sub.id}:`, pushErr);
          // If the subscription is no longer valid, delete it
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
            console.log(`Deleted expired subscription ID: ${sub.id}`);
          }
        }
      }

      // 3. Mark event as notified
      await supabase
        .from('events')
        .update({ notified: true })
        .eq('id', event.id);
    }

    return NextResponse.json({
      status: 'success',
      eventsChecked: upcomingEvents.length,
      notificationsSent: notificationsSentCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json({ error: 'Failed to send notifications', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
