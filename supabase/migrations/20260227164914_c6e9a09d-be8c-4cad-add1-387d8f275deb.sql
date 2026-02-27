
-- Add value breakdown and recurrence fields to opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS value_implantacao numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS value_saas numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS first_payment_date date DEFAULT NULL;

-- Create a trigger to auto-calculate total value from components
CREATE OR REPLACE FUNCTION public.calculate_opportunity_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- If either component value is set, calculate total; otherwise keep manual value
  IF NEW.value_implantacao IS NOT NULL OR NEW.value_saas IS NOT NULL THEN
    NEW.value := COALESCE(NEW.value_implantacao, 0) + COALESCE(NEW.value_saas, 0);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_calculate_opportunity_value
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_opportunity_value();
