-- One-time, read-only export helper for the existing Supabase project.
-- Run in Supabase SQL Editor only when preparing a migration backup.
-- Copy the single JSON value from the result into a PRIVATE export-las.json file.
-- This query does not modify or delete any Supabase data.

SELECT jsonb_build_object(
  'members', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.members AS t), '[]'::jsonb),
  'monthly_contributions', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.monthly_contributions AS t), '[]'::jsonb),
  'member_payments', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.member_payments AS t), '[]'::jsonb),
  'posts', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.posts AS t), '[]'::jsonb),
  'media_items', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.media_items AS t), '[]'::jsonb),
  'post_comments', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.post_comments AS t), '[]'::jsonb),
  'profiles_for_manual_account_recreation', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.profiles AS t), '[]'::jsonb),
  'username_map_for_manual_account_recreation', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.auth_login_map AS t), '[]'::jsonb)
) AS las_export;
