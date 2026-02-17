-- Promptory Admin Analytics Dashboard
-- RPC function: get_admin_stats
-- Returns global usage statistics (only for is_admin=true users)

CREATE OR REPLACE FUNCTION get_admin_stats(days_back INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  result JSON;
  caller_is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT COALESCE(is_admin, false) INTO caller_is_admin
  FROM public.profiles WHERE id = auth.uid();
  
  IF NOT caller_is_admin THEN
    RETURN json_build_object('error', 'Admin access required');
  END IF;

  SELECT json_build_object(
    -- Global counts
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'premium_users', (SELECT COUNT(*) FROM public.profiles WHERE is_premium = true),
    'total_prompts', (SELECT COUNT(*) FROM public.prompts),
    'total_library_prompts', (SELECT COUNT(*) FROM public.library_prompts),
    'total_library_approved', (SELECT COUNT(*) FROM public.library_prompts WHERE is_approved = true),
    'total_reports_pending', (SELECT COUNT(*) FROM public.prompt_reports WHERE status = 'pending'),
    
    -- Usage stats (within time window)
    'total_uses', (
      SELECT COUNT(*) FROM public.usage_history 
      WHERE used_at >= NOW() - (days_back || ' days')::INTERVAL
    ),
    'unique_active_users', (
      SELECT COUNT(DISTINCT user_id) FROM public.usage_history 
      WHERE used_at >= NOW() - (days_back || ' days')::INTERVAL
    ),
    
    -- Daily usage (for chart)
    'daily_usage', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT DATE(used_at) as date, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
        FROM public.usage_history 
        WHERE used_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(used_at) ORDER BY date DESC
      ) d
    ),
    
    -- Top prompts globally
    'top_prompts_global', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT prompt_title as title, COUNT(*) as uses, COUNT(DISTINCT user_id) as unique_users
        FROM public.usage_history 
        WHERE used_at >= NOW() - (days_back || ' days')::INTERVAL AND prompt_title IS NOT NULL
        GROUP BY prompt_title ORDER BY uses DESC LIMIT 10
      ) t
    ),
    
    -- Platform distribution
    'platform_stats', (
      SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT COALESCE(platform, 'unknown') as platform, COUNT(*) as count
        FROM public.usage_history 
        WHERE used_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY platform ORDER BY count DESC
      ) p
    ),
    
    -- New users over time
    'new_users_daily', (
      SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)
      FROM (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM public.profiles 
        WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at) ORDER BY date DESC
      ) u
    ),
    
    -- Most liked library prompts
    'top_library_prompts', (
      SELECT COALESCE(json_agg(row_to_json(lp)), '[]'::json)
      FROM (
        SELECT title, author, likes, downloads, category
        FROM public.library_prompts 
        WHERE is_approved = true
        ORDER BY likes DESC LIMIT 10
      ) lp
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_stats(INTEGER) TO authenticated;
