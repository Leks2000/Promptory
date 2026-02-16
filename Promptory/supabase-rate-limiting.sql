-- =============================================
-- Rate Limiting for Supabase Edge Functions
-- Run this in Supabase SQL Editor
-- =============================================

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint 
  ON public.rate_limits(user_id, endpoint, window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role access only (Edge Functions)
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate limits" ON public.rate_limits
  FOR ALL USING (true);

-- Rate limit check function
-- Returns true if the request should be ALLOWED, false if rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 60,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSON AS $$
DECLARE
  window_start_time TIMESTAMP WITH TIME ZONE;
  current_count INTEGER;
  is_allowed BOOLEAN;
BEGIN
  window_start_time := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Count requests in current window
  SELECT COALESCE(SUM(request_count), 0) INTO current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint
    AND window_start >= window_start_time;
  
  is_allowed := current_count < p_max_requests;
  
  IF is_allowed THEN
    -- Record this request
    INSERT INTO public.rate_limits (user_id, endpoint, request_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, NOW());
  END IF;
  
  -- Clean up old entries (older than 5 minutes)
  DELETE FROM public.rate_limits 
  WHERE window_start < NOW() - INTERVAL '5 minutes';
  
  RETURN json_build_object(
    'allowed', is_allowed,
    'current', current_count,
    'limit', p_max_requests,
    'remaining', GREATEST(0, p_max_requests - current_count - (CASE WHEN is_allowed THEN 1 ELSE 0 END)),
    'reset_at', (NOW() + (p_window_seconds || ' seconds')::INTERVAL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limit presets for different endpoints:
-- Library read:     120 req / 60s
-- Library write:     10 req / 60s
-- Report submit:      3 req / 60s
-- Like toggle:       30 req / 60s
-- Share to library:   5 req / 60s
-- Webhook:           60 req / 60s

COMMENT ON FUNCTION check_rate_limit IS 
  'Rate limiter for Edge Functions. Call with (user_id, endpoint, max_requests, window_seconds). Returns JSON with allowed boolean.';

-- Grant access
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
