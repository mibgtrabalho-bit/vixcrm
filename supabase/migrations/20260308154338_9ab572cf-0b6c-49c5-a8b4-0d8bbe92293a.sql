
-- Drop the three RESTRICTIVE SELECT policies on contacts
DROP POLICY IF EXISTS "Directors see all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Managers see team contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sellers see own contacts" ON public.contacts;

-- Recreate as PERMISSIVE so they OR together
CREATE POLICY "Directors see all contacts" ON public.contacts
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor'::app_role)
);

CREATE POLICY "Managers see team contacts" ON public.contacts
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor'::app_role)
  AND id IN (SELECT manager_visible_contact_ids(auth.uid()))
);

CREATE POLICY "Sellers see own contacts" ON public.contacts
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND id IN (SELECT user_visible_contact_ids(auth.uid()))
);
