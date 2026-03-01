
-- Add first_won_at to opportunities (set once when stage becomes 'fechado')
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS first_won_at timestamp with time zone;

-- Trigger to set first_won_at only once
CREATE OR REPLACE FUNCTION public.set_first_won_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stage = 'fechado' AND (OLD.stage IS DISTINCT FROM 'fechado') AND NEW.first_won_at IS NULL THEN
    NEW.first_won_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_first_won_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_first_won_at();
