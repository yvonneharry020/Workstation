-- ============================================================
-- 019: Add job_postings to supabase_realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE job_postings;
