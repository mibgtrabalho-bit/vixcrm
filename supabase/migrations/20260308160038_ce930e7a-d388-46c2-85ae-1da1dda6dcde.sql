
-- Recreate INSERT policy without TO clause (defaults to PUBLIC = all roles)
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;

CREATE POLICY "Users can create contacts" ON public.contacts
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND created_by = auth.uid()
);
