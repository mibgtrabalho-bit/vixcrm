
-- Fix: All policies are RESTRICTIVE but PostgreSQL requires at least one
-- PERMISSIVE policy. RESTRICTIVE only narrows PERMISSIVE access.

-- CONTACTS: Recreate all as PERMISSIVE
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;
CREATE POLICY "Users can create contacts" ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Directors see all contacts" ON public.contacts;
CREATE POLICY "Directors see all contacts" ON public.contacts
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Managers see team contacts" ON public.contacts;
CREATE POLICY "Managers see team contacts" ON public.contacts
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND id IN (SELECT manager_visible_contact_ids(auth.uid())));

DROP POLICY IF EXISTS "Sellers see own contacts" ON public.contacts;
CREATE POLICY "Sellers see own contacts" ON public.contacts
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND id IN (SELECT user_visible_contact_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update tenant contacts" ON public.contacts;
CREATE POLICY "Users can update tenant contacts" ON public.contacts
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

-- COMPANIES: Recreate all as PERMISSIVE
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
CREATE POLICY "Users can create companies" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Directors see all companies" ON public.companies;
CREATE POLICY "Directors see all companies" ON public.companies
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Managers see team companies" ON public.companies;
CREATE POLICY "Managers see team companies" ON public.companies
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND id IN (SELECT manager_visible_company_ids(auth.uid())));

DROP POLICY IF EXISTS "Sellers see own companies" ON public.companies;
CREATE POLICY "Sellers see own companies" ON public.companies
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND id IN (SELECT user_visible_company_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update tenant companies" ON public.companies;
CREATE POLICY "Users can update tenant companies" ON public.companies
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

-- OPPORTUNITIES: Recreate all as PERMISSIVE
DROP POLICY IF EXISTS "Users can create opportunities" ON public.opportunities;
CREATE POLICY "Users can create opportunities" ON public.opportunities
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Directors see all opportunities" ON public.opportunities;
CREATE POLICY "Directors see all opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Managers see team opportunities" ON public.opportunities;
CREATE POLICY "Managers see team opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND is_in_managed_team(auth.uid(), assigned_to));

DROP POLICY IF EXISTS "Vendedor sees own opportunities" ON public.opportunities;
CREATE POLICY "Vendedor sees own opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND (assigned_to = auth.uid() OR created_by = auth.uid()));

DROP POLICY IF EXISTS "Directors can update all opportunities" ON public.opportunities;
CREATE POLICY "Directors can update all opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Managers can update team opportunities" ON public.opportunities;
CREATE POLICY "Managers can update team opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND is_in_managed_team(auth.uid(), assigned_to));

DROP POLICY IF EXISTS "Sellers can update own opportunities" ON public.opportunities;
CREATE POLICY "Sellers can update own opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND assigned_to = auth.uid());

NOTIFY pgrst, 'reload schema';
