
-- Fix: INSERT policy is RESTRICTIVE, must be PERMISSIVE
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;

CREATE POLICY "Users can create contacts" ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND created_by = auth.uid()
);

-- Same fix for companies INSERT
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

CREATE POLICY "Users can create companies" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND created_by = auth.uid()
);
