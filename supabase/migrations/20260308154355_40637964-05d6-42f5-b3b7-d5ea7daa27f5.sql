
-- Fix companies SELECT policies: RESTRICTIVE → PERMISSIVE (same bug pattern)
DROP POLICY IF EXISTS "Directors see all companies" ON public.companies;
DROP POLICY IF EXISTS "Managers see team companies" ON public.companies;
DROP POLICY IF EXISTS "Sellers see own companies" ON public.companies;

CREATE POLICY "Directors see all companies" ON public.companies
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor'::app_role)
);

CREATE POLICY "Managers see team companies" ON public.companies
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor'::app_role)
  AND id IN (SELECT manager_visible_company_ids(auth.uid()))
);

CREATE POLICY "Sellers see own companies" ON public.companies
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND id IN (SELECT user_visible_company_ids(auth.uid()))
);
