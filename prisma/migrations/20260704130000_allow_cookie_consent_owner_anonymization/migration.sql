-- Keep cookie consent records append-only while allowing account deletion to
-- anonymize their owner reference through the existing ON DELETE SET NULL FK.
CREATE OR REPLACE FUNCTION public.prevent_cookie_consents_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.owner_id IS NOT NULL
    AND NEW.owner_id IS NULL
    AND (to_jsonb(NEW) - 'owner_id') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'owner_id')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'cookie_consents is append-only';
END;
$$;
