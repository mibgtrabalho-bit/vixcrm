
-- =============================================
-- FIX: Recreate ALL policies as PERMISSIVE
-- =============================================

-- CONTACTS: Drop all
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;
DROP POLICY IF EXISTS "Directors see all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Managers see team contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sellers see own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update tenant contacts" ON public.contacts;

-- CONTACTS: Recreate as PERMISSIVE
CREATE POLICY "Users can create contacts" ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Directors see all contacts" ON public.contacts
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers see team contacts" ON public.contacts
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND id IN (SELECT manager_visible_contact_ids(auth.uid())));

CREATE POLICY "Sellers see own contacts" ON public.contacts
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND id IN (SELECT user_visible_contact_ids(auth.uid())));

CREATE POLICY "Users can update tenant contacts" ON public.contacts
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

-- COMPANIES: Drop all
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Directors see all companies" ON public.companies;
DROP POLICY IF EXISTS "Managers see team companies" ON public.companies;
DROP POLICY IF EXISTS "Sellers see own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can update tenant companies" ON public.companies;

-- COMPANIES: Recreate as PERMISSIVE
CREATE POLICY "Users can create companies" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Directors see all companies" ON public.companies
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers see team companies" ON public.companies
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND id IN (SELECT manager_visible_company_ids(auth.uid())));

CREATE POLICY "Sellers see own companies" ON public.companies
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND id IN (SELECT user_visible_company_ids(auth.uid())));

CREATE POLICY "Users can update tenant companies" ON public.companies
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

-- OPPORTUNITIES: Drop all
DROP POLICY IF EXISTS "Users can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Directors see all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Managers see team opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Vendedor sees own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Directors can update all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Managers can update team opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Sellers can update own opportunities" ON public.opportunities;

-- OPPORTUNITIES: Recreate as PERMISSIVE
CREATE POLICY "Users can create opportunities" ON public.opportunities
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Directors see all opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers see team opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND is_in_managed_team(auth.uid(), assigned_to));

CREATE POLICY "Vendedor sees own opportunities" ON public.opportunities
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND tenant_id = get_user_tenant(auth.uid()) AND (assigned_to = auth.uid() OR created_by = auth.uid()));

CREATE POLICY "Directors can update all opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers can update team opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND is_in_managed_team(auth.uid(), assigned_to));

CREATE POLICY "Sellers can update own opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND assigned_to = auth.uid());

-- REMAINING TABLES: Fix restrictive policies too

-- PROFILES
DROP POLICY IF EXISTS "Users can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Directors can update tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update team seller profiles" ON public.profiles;

CREATE POLICY "Users can view tenant profiles" ON public.profiles
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Directors can update tenant profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers can update team seller profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND NOT has_role(user_id, 'gestor') AND NOT has_role(user_id, 'diretor') AND is_in_managed_team(auth.uid(), user_id))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND NOT has_role(user_id, 'gestor') AND NOT has_role(user_id, 'diretor') AND is_in_managed_team(auth.uid(), user_id));

-- INVITATIONS
DROP POLICY IF EXISTS "Directors manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers manage team invitations" ON public.invitations;

CREATE POLICY "Directors manage invitations" ON public.invitations
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers manage team invitations" ON public.invitations
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor') AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- MONTHLY_TARGETS
DROP POLICY IF EXISTS "Vendedor sees own targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "Managers see tenant targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "Managers can insert targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "Managers can update targets" ON public.monthly_targets;

CREATE POLICY "Vendedor sees own targets" ON public.monthly_targets
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Managers see tenant targets" ON public.monthly_targets
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'diretor')));

CREATE POLICY "Managers can insert targets" ON public.monthly_targets
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'diretor')));

CREATE POLICY "Managers can update targets" ON public.monthly_targets
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'diretor')));

-- TEAMS
DROP POLICY IF EXISTS "Users can view tenant teams" ON public.teams;
DROP POLICY IF EXISTS "Directors can manage teams" ON public.teams;

CREATE POLICY "Users can view tenant teams" ON public.teams
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Directors can manage teams" ON public.teams
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

-- TEAM_MEMBERS
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Directors can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Directors can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Directors can delete team members" ON public.team_members;

CREATE POLICY "Users can view team members" ON public.team_members
FOR SELECT TO authenticated
USING (team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

CREATE POLICY "Directors can insert team members" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'diretor') AND team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

CREATE POLICY "Directors can update team members" ON public.team_members
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'diretor') AND team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

CREATE POLICY "Directors can delete team members" ON public.team_members
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'diretor') AND team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

-- TENANTS
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Directors can update tenant" ON public.tenants;

CREATE POLICY "Users can view own tenant" ON public.tenants
FOR SELECT TO authenticated
USING (id = get_user_tenant(auth.uid()));

CREATE POLICY "Directors can update tenant" ON public.tenants
FOR UPDATE TO authenticated
USING (id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

-- USER_ROLES
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can view roles" ON public.user_roles;

CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Managers can view roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'diretor'));

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
