
-- Remove the overly permissive INSERT policy on tenants since trigger handles it now
DROP POLICY IF EXISTS "Anyone can create tenants" ON public.tenants;
