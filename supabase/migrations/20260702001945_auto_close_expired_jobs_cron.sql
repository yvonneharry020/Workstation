
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-close-expired-jobs',
  '0 1 * * *',
  $$
    UPDATE job_postings
    SET status = 'expired'
    WHERE status = 'active'
      AND application_deadline IS NOT NULL
      AND application_deadline < CURRENT_DATE;
  $$
);
