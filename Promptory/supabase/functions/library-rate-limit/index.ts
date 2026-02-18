// Promptory — Library Rate Limiting Edge Function
// Supabase Edge Function
//
// Deploy: supabase functions deploy library-rate-limit
//
// This function wraps library write operations (share, like, report)
// with server-side rate limiting to prevent spam.
//
// Endpoints:
//   POST /share   — Share prompt to library (5 req/min)
//   POST /like    — Toggle like (30 req/min)
//   POST /report  — Submit report (3 req/min)
//
// The check_rate_limit() SQL function (supabase-rate-limiting.sql) must be deployed first.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit presets per endpoint
const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  share:  { max: 5,  window: 60 },
  like:   { max: 30, window: 60 },
  report: { max: 3,  window: 60 },
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client to get user
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const url = new URL(req.url);
    const endpoint = url.pathname.split("/").pop() || "";
    const body = await req.json().catch(() => ({}));

    // Check rate limit config
    const limitConfig = RATE_LIMITS[endpoint];
    if (!limitConfig) {
      return new Response(
        JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Service role client for rate limit check
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check rate limit
    const { data: rlData, error: rlError } = await supabaseAdmin.rpc("check_rate_limit", {
      p_user_id: user.id,
      p_endpoint: `library_${endpoint}`,
      p_max_requests: limitConfig.max,
      p_window_seconds: limitConfig.window,
    });

    if (rlError) {
      console.error("Rate limit check failed:", rlError);
      // Fail open: allow the request if rate limit check itself fails
    } else if (rlData && !rlData.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limited",
          message: `Too many requests. Try again in ${limitConfig.window} seconds.`,
          remaining: 0,
          reset_at: rlData.reset_at,
        }),
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Retry-After": String(limitConfig.window),
            "X-RateLimit-Limit": String(limitConfig.max),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Forward the actual operation to the appropriate RPC
    let result;
    switch (endpoint) {
      case "share": {
        const { data, error } = await supabaseAdmin.rpc("share_to_library", body);
        result = { data, error };
        break;
      }
      case "like": {
        const { data, error } = await supabaseAdmin.rpc("toggle_library_like", body);
        result = { data, error };
        break;
      }
      case "report": {
        const { data, error } = await supabaseAdmin.from("prompt_reports").insert({
          prompt_id: body.prompt_id,
          reporter_id: user.id,
          reason: body.reason,
          details: body.details,
        });
        result = { data, error };
        break;
      }
    }

    if (result?.error) {
      return new Response(
        JSON.stringify({ error: result.error.message || result.error }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        data: result?.data,
        rateLimit: rlData ? {
          remaining: rlData.remaining,
          limit: limitConfig.max,
          reset_at: rlData.reset_at,
        } : null,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          ...(rlData ? {
            "X-RateLimit-Limit": String(limitConfig.max),
            "X-RateLimit-Remaining": String(rlData.remaining),
          } : {}),
        },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
