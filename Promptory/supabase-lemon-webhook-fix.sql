-- =============================================
-- LemonSqueezy Webhook Audit Log + Fix 401 errors
-- Run this in Supabase SQL Editor
-- =============================================

-- Create lemon_webhooks table if not exists (audit log for all webhook events)
CREATE TABLE IF NOT EXISTS public.lemon_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_email TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- No RLS needed — only Edge Function (service role) writes to this table
-- But enable it with service role policy just in case
ALTER TABLE public.lemon_webhooks ENABLE ROW LEVEL SECURITY;

-- Allow service role (Edge Function) to insert
DROP POLICY IF EXISTS "Service role can insert webhooks" ON public.lemon_webhooks;
CREATE POLICY "Service role can insert webhooks" ON public.lemon_webhooks
  FOR INSERT WITH CHECK (true);

-- Allow admins to view webhook logs
DROP POLICY IF EXISTS "Admins can view webhooks" ON public.lemon_webhooks;
CREATE POLICY "Admins can view webhooks" ON public.lemon_webhooks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lemon_webhooks_event_type ON public.lemon_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_lemon_webhooks_user_email ON public.lemon_webhooks(user_email);
CREATE INDEX IF NOT EXISTS idx_lemon_webhooks_created_at ON public.lemon_webhooks(created_at DESC);

-- =============================================
-- IMPORTANT: Deployment instructions for fixing 401 errors
-- =============================================
-- 
-- The 401 errors happen because Supabase Edge Functions require JWT
-- authentication by default. LemonSqueezy webhooks don't send JWT tokens —
-- they use HMAC signatures instead.
--
-- To fix, you MUST deploy the Edge Function with --no-verify-jwt:
--
--   supabase functions deploy lemon-webhook --no-verify-jwt
--
-- Or if using the Supabase dashboard, go to:
--   Edge Functions > lemon-webhook-index > Settings > 
--   Disable "Verify JWT" toggle
--
-- Required secrets (set in Edge Functions > Secrets):
--   LEMON_SIGNING_SECRET = your LemonSqueezy webhook signing secret
--   SUPABASE_SERVICE_ROLE_KEY = your Supabase service_role key
--
-- LemonSqueezy webhook URL should be:
--   https://vofgfvlgchqheksvlibl.supabase.co/functions/v1/lemon-webhook
--
-- =============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.lemon_webhooks TO service_role;
GRANT INSERT ON TABLE public.lemon_webhooks TO authenticated;
