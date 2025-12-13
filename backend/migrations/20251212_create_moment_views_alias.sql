-- Create an alias view so rest/v1/moment_views works when the existing view is `moments_view`
CREATE OR REPLACE VIEW public.moment_views AS
SELECT *
FROM public.moments_view;

-- Note: If your API expects an aggregated shape (e.g. moment_id + view_count),
-- replace the SELECT with an aggregate query over your per-view log table.
-- Example (uncomment and adjust table name if needed):
--
-- CREATE OR REPLACE VIEW public.moment_views AS
-- SELECT moment_id, COUNT(*) AS view_count, MAX(served_at) AS last_viewed_at
-- FROM public.moment_impressions
-- GROUP BY moment_id;
