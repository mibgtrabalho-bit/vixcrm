
ALTER TABLE public.opportunities RENAME COLUMN first_won_at TO first_closed_at;

CREATE OR REPLACE FUNCTION public.set_first_won_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stage = 'fechado' AND (OLD.stage IS DISTINCT FROM 'fechado') AND NEW.first_closed_at IS NULL THEN
    NEW.first_closed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
