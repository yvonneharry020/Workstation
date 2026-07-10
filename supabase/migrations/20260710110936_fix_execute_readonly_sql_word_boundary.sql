-- Previous version used \b for a "word boundary" after "select", but
-- Postgres's regex flavor (ARE) treats \b as a literal backspace character,
-- not a word boundary — so '^\s*select\b' never matched anything, and every
-- valid SELECT was wrongly rejected. \y is the correct ARE word-boundary
-- escape. Caught by testing before reporting this as done.

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

  IF trimmed !~* '^\s*select\y' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;

  RETURN QUERY EXECUTE format('SELECT to_jsonb(_sq) FROM (%s) AS _sq LIMIT 100', trimmed);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_readonly_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_readonly_sql(text) TO authenticated;
