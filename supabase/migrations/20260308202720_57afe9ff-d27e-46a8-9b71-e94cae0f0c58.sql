
-- Add last_activity_at to opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- Backfill: use the latest stage change or updated_at
UPDATE public.opportunities o
SET last_activity_at = COALESCE(
  (SELECT MAX(changed_at) FROM public.opportunity_stage_history h WHERE h.opportunity_id = o.id),
  o.updated_at,
  o.created_at
);

-- Trigger function: update last_activity_at on stage change or notes change
CREATE OR REPLACE FUNCTION public.update_last_activity_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage OR OLD.notes IS DISTINCT FROM NEW.notes THEN
    NEW.last_activity_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- Attach trigger
CREATE TRIGGER trg_update_last_activity_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_activity_at();
