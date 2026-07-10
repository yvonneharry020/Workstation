-- (tech)/database/page.tsx has called supabase.rpc('execute_readonly_sql', ...)
-- since it was built, but this function never existed in the database. The
-- RPC call always failed, and the page silently fell back to a regex
-- ("from\s+(\w+)") that guessed a table name out of the typed query and ran
-- an unrelated `.from(table).select('*').limit(25)` instead — misleading:
-- the UI looked like a real read-only SQL console but wasn't running the
-- user's query at all, and the only client-side guard against non-SELECT
-- input was trivially bypassable had the RPC ever been implemented naively.
--
-- This implements the function for real, safely:
--  - SECURITY INVOKER (the default, stated explicitly): runs as the calling
--    user, so every table's existing RLS policies still fully apply. This
--    grants no new access — a tech staffer can only see through this console
--    exactly what their own row-level permissions already allow elsewhere.
--  - Rejects anything but a single SELECT statement (blocks semicolon
--    statement-stacking) and wraps it as SELECT ... FROM (<query>) AS _sq,
--    which also fails cleanly on multi-statement input since a stray
--    semicolon breaks the subquery's parse rather than executing.
--  - Hard LIMIT 100 regardless of what the caller asked for.
--  - 5s statement timeout so a heavy query can't tie up a connection.

CREATE OR REPLACE FUNCTION public.execute_readonly_sql(sql text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  trimmed text := btrim(sql);
BEGIN
  IF trimmed = '' THEN
    RAISE EXCEPTION 'Empty query';
  END IF;

  trimmed := regexp_replace(trimmed, ';\s*$', '');
  IF trimmed ~ ';' THEN
    RAISE EXCEPTION 'Only a single statement is allowed';
  END IF;

  IF trimmed !~* '^\s*select\b' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;

  RETURN QUERY EXECUTE format('SELECT to_jsonb(_sq) FROM (%s) AS _sq LIMIT 100', trimmed);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_readonly_sql(text) TO authenticated;
