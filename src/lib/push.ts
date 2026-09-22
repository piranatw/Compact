import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; statusCode?: number; expired: boolean; error: string }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: 1800 }
    );
    return { ok: true };
  } catch (err) {
    const anyErr = err as { statusCode?: number; message?: string };
    const expired = anyErr.statusCode === 404 || anyErr.statusCode === 410;
    return { ok: false, statusCode: anyErr.statusCode, expired, error: anyErr.message ?? String(err) };
  }
}
