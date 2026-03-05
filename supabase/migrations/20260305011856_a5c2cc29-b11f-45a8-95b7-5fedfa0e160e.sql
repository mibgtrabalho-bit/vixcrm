
-- Add soft-delete columns to opportunities, contacts, companies
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- Update ALL existing RLS policies on opportunities to filter deleted_at IS NULL

-- DROP and recreate SELECT policies for opportunities
DROP POLICY IF EXISTS "Managers see team opportunities" ON public.opportunities;
CREATE POLICY "Managers see team opportunities" ON public.opportunities
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tenant_id = get_user_tenant(auth.uid())
    AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'diretor'))
  );

DROP POLICY IF EXISTS "Vendedor sees own opportunities" ON public.opportunities;
CREATE POLICY "Vendedor sees own opportunities" ON public.opportunities
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tenant_id = get_user_tenant(auth.uid())
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
  );

-- UPDATE policy for opportunities (add deleted_at IS NULL)
DROP POLICY IF EXISTS "Users can update own opportunities" ON public.opportunities;
CREATE POLICY "Users can update own opportunities" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND (assigned_to = auth.uid() OR has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'diretor'))
  );

-- DROP and recreate SELECT policies for contacts
DROP POLICY IF EXISTS "Users can view tenant contacts" ON public.contacts;
CREATE POLICY "Users can view tenant contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tenant_id = get_user_tenant(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update tenant contacts" ON public.contacts;
CREATE POLICY "Users can update tenant contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
  );

-- DROP and recreate SELECT policies for companies
DROP POLICY IF EXISTS "Users can view tenant companies" ON public.companies;
CREATE POLICY "Users can view tenant companies" ON public.companies
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tenant_id = get_user_tenant(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update tenant companies" ON public.companies;
CREATE POLICY "Users can update tenant companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
  );
