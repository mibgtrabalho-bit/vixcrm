
-- 1) Helper: check if target_user is in any team managed by current user
CREATE OR REPLACE FUNCTION public.is_in_managed_team(_manager_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _manager_id AND tm2.user_id = _target_user_id
  )
$$;

-- 2) Helper: get contact IDs visible to a seller
CREATE OR REPLACE FUNCTION public.user_visible_contact_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM contacts WHERE created_by = _user_id
  UNION
  SELECT DISTINCT contact_id FROM opportunities
  WHERE contact_id IS NOT NULL AND (assigned_to = _user_id OR created_by = _user_id)
$$;

-- 3) Helper: get company IDs visible to a seller
CREATE OR REPLACE FUNCTION public.user_visible_company_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM companies WHERE created_by = _user_id
  UNION
  SELECT DISTINCT company_id FROM opportunities
  WHERE company_id IS NOT NULL AND (assigned_to = _user_id OR created_by = _user_id)
$$;

-- 4) Helper: get contact IDs visible to a manager (team-scoped)
CREATE OR REPLACE FUNCTION public.manager_visible_contact_ids(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM contacts WHERE created_by = _manager_id
  UNION
  SELECT DISTINCT o.contact_id FROM opportunities o
  WHERE o.contact_id IS NOT NULL
    AND o.tenant_id = get_user_tenant(_manager_id)
    AND is_in_managed_team(_manager_id, o.assigned_to)
$$;

-- 5) Helper: get company IDs visible to a manager (team-scoped)
CREATE OR REPLACE FUNCTION public.manager_visible_company_ids(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM companies WHERE created_by = _manager_id
  UNION
  SELECT DISTINCT o.company_id FROM opportunities o
  WHERE o.company_id IS NOT NULL
    AND o.tenant_id = get_user_tenant(_manager_id)
    AND is_in_managed_team(_manager_id, o.assigned_to)
$$;

-- ===== OPPORTUNITIES =====

-- Drop old broad policies
DROP POLICY IF EXISTS "Managers see team opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update own opportunities" ON public.opportunities;

-- Directors see all tenant opportunities
CREATE POLICY "Directors see all opportunities"
ON public.opportunities FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
);

-- Managers see only their team's opportunities
CREATE POLICY "Managers see team opportunities"
ON public.opportunities FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND is_in_managed_team(auth.uid(), assigned_to)
);

-- Sellers update own
CREATE POLICY "Sellers can update own opportunities"
ON public.opportunities FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND assigned_to = auth.uid()
);

-- Managers update team opportunities
CREATE POLICY "Managers can update team opportunities"
ON public.opportunities FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND is_in_managed_team(auth.uid(), assigned_to)
);

-- Directors update all tenant opportunities
CREATE POLICY "Directors can update all opportunities"
ON public.opportunities FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
);

-- ===== TEAMS: only directors can manage =====
DROP POLICY IF EXISTS "Managers can manage teams" ON public.teams;

CREATE POLICY "Directors can manage teams"
ON public.teams FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
)
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
);

-- ===== CONTACTS: role-based visibility =====
DROP POLICY IF EXISTS "Users can view tenant contacts" ON public.contacts;

CREATE POLICY "Directors see all contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
);

CREATE POLICY "Managers see team contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND id IN (SELECT manager_visible_contact_ids(auth.uid()))
);

CREATE POLICY "Sellers see own contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND id IN (SELECT user_visible_contact_ids(auth.uid()))
);

-- ===== COMPANIES: role-based visibility =====
DROP POLICY IF EXISTS "Users can view tenant companies" ON public.companies;

CREATE POLICY "Directors see all companies"
ON public.companies FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
);

CREATE POLICY "Managers see team companies"
ON public.companies FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND id IN (SELECT manager_visible_company_ids(auth.uid()))
);

CREATE POLICY "Sellers see own companies"
ON public.companies FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND tenant_id = get_user_tenant(auth.uid())
  AND id IN (SELECT user_visible_company_ids(auth.uid()))
);
