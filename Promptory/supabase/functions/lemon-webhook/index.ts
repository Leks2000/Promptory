// Promptory — LemonSqueezy Webhook Handler
// Supabase Edge Function
//
// CRITICAL: This function must be deployed with --no-verify-jwt flag:
//   supabase functions deploy lemon-webhook --no-verify-jwt
//
// Why: LemonSqueezy sends POST requests with HMAC signature (X-Signature header),
// NOT a Bearer JWT token. Without --no-verify-jwt, Supabase returns 401 for all
// webhook calls because they lack a valid Authorization header.
//
// Environment variables required (set in Supabase Dashboard > Edge Functions > Secrets):
//   LEMON_SIGNING_SECRET  — from LemonSqueezy > Settings > Webhooks > Signing secret
//   SUPABASE_SERVICE_ROLE_KEY — from Supabase > Settings > API > service_role key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LEMON_SIGNING_SECRET = Deno.env.get("LEMON_SIGNING_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// --- HMAC Signature Verification ---
async function verifySignature(
  payload: string,
  signatureHeader: string
): Promise<boolean> {
  if (!LEMON_SIGNING_SECRET) {
    console.error("LEMON_SIGNING_SECRET not set!");
    return false;
  }
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(LEMON_SIGNING_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    const expectedHex = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expectedHex === signatureHeader;
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

// --- Supabase admin client (service role — bypasses RLS) ---
function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// Define types for webhook data
interface WebhookAttributes {
  id?: string;
  status?: string;
  user_email?: string;
  customer_email?: string;
  custom_data?: CustomData;
  first_order_item?: {
    custom_data?: CustomData;
  };
}

interface CustomData {
  user_id?: string;
  user_email?: string;
}

interface WebhookData {
  id?: string;
  attributes?: WebhookAttributes;
}

// --- Map LemonSqueezy event to premium status update ---
async function handleSubscriptionEvent(
  eventName: string,
  data: WebhookData
) {
  const supabase = getSupabaseAdmin();
  const attrs = data?.attributes || data as unknown as WebhookAttributes;
  const customData = attrs?.custom_data || attrs?.first_order_item?.custom_data || {};
  
  // Try to extract user info from multiple possible locations
  const userEmail =
    attrs?.user_email ||
    customData?.user_email ||
    attrs?.customer_email ||
    null;
  const userId = customData?.user_id || null;
  const subscriptionId = attrs?.id || data?.id || null;
  const status = attrs?.status || null;

  console.log(
    `[webhook] event=${eventName} email=${userEmail} userId=${userId} status=${status} subId=${subscriptionId}`
  );

  // Log webhook to lemon_webhooks table for audit
  try {
    await supabase.from("lemon_webhooks").insert({
      event_type: eventName,
      user_email: userEmail,
      payload: { data, eventName },
    });
  } catch (logErr) {
    console.warn("Failed to log webhook:", logErr);
  }

  // Determine if this event should activate or deactivate premium
  const activateEvents = [
    "subscription_created",
    "subscription_resumed",
    "subscription_unpaused",
    "subscription_payment_success",
    "order_created",
  ];
  const deactivateEvents = [
    "subscription_expired",
    "subscription_cancelled",
    "subscription_paused",
    "subscription_payment_failed",
  ];

  let isPremium: boolean | null = null;
  if (activateEvents.includes(eventName)) {
    // For subscription_cancelled with status "cancelled" — LemonSqueezy still allows
    // access until the end of the billing period, so keep premium active
    if (eventName === "subscription_cancelled" && status === "cancelled") {
      // Don't change; user keeps access until expiry
      console.log("[webhook] Cancelled but still active until period end");
      return;
    }
    isPremium = true;
  } else if (deactivateEvents.includes(eventName)) {
    isPremium = false;
  }

  if (isPremium === null) {
    console.log(`[webhook] Event ${eventName} does not change premium status`);
    return;
  }

  // Find the user profile by email or userId
  let profileId = userId;
  if (!profileId && userEmail) {
    // Look up by email in profiles table
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", userEmail)
      .limit(1);
    if (profiles && profiles.length > 0) {
      profileId = profiles[0].id;
    }
  }

  if (!profileId) {
    console.error(
      `[webhook] Cannot find user for email=${userEmail} userId=${userId}`
    );
    return;
  }

  // Update profile
  const updateData: Record<string, unknown> = {
    is_premium: isPremium,
    prompt_limit: isPremium ? 9999 : 20,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", profileId);

  if (error) {
    console.error(`[webhook] Failed to update profile ${profileId}:`, error);
  } else {
    console.log(
      `[webhook] Updated profile ${profileId}: premium=${isPremium}`
    );
  }
}

// --- Main handler ---
serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read body as text for signature verification
  const rawBody = await req.text();

  // Verify HMAC signature from LemonSqueezy
  const signature = req.headers.get("x-signature") || req.headers.get("X-Signature") || "";
  if (!signature) {
    console.error("[webhook] Missing X-Signature header");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    console.error("[webhook] Invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse JSON payload
  let payload: { meta?: { event_name?: string }; data?: WebhookData };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract event name (LemonSqueezy sends it in meta.event_name)
  const eventName =
    payload?.meta?.event_name ||
    req.headers.get("x-event-name") ||
    req.headers.get("X-Event-Name") ||
    "unknown";

  console.log(`[webhook] Received event: ${eventName}`);

  try {
    await handleSubscriptionEvent(eventName, payload?.data || {});
  } catch (e) {
    console.error("[webhook] Handler error:", e);
    // Still return 200 so LemonSqueezy doesn't retry indefinitely
  }

  return new Response(JSON.stringify({ success: true, event: eventName }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});