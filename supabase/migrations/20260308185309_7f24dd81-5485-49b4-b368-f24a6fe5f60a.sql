
ALTER TABLE public.monthly_targets
  ADD COLUMN target_saas numeric NOT NULL DEFAULT 0,
  ADD COLUMN target_setup numeric NOT NULL DEFAULT 0;

-- Backfill: copy old target_value into target_saas for backward compatibility
UPDATE public.monthly_targets SET target_saas = target_value WHERE target_value > 0;
