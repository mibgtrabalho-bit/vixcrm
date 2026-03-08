
-- 1. Create team_targets table
CREATE TABLE public.team_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  month date NOT NULL,
  target_saas numeric NOT NULL DEFAULT 0,
  target_setup numeric NOT NULL DEFAULT 0,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, month)
);

ALTER TABLE public.team_targets ENABLE ROW LEVEL SECURITY;

-- Directors: full access
CREATE POLICY "Directors manage team targets"
ON public.team_targets FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'::app_role));

-- Managers: read-only on own team targets
CREATE POLICY "Managers view own team targets"
ON public.team_targets FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role) AND team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()));

-- 2. Tighten monthly_targets RLS: split old combined policies into role-specific ones
DROP POLICY IF EXISTS "Managers can insert targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "Managers can update targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "Managers see tenant targets" ON public.monthly_targets;

-- Directors: full access to seller targets
CREATE POLICY "Directors can insert targets"
ON public.monthly_targets FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Directors can update targets"
ON public.monthly_targets FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Directors see all targets"
ON public.monthly_targets FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'::app_role));

-- Managers: only their team members' targets
CREATE POLICY "Managers can insert team member targets"
ON public.monthly_targets FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role) AND is_in_managed_team(auth.uid(), user_id));

CREATE POLICY "Managers can update team member targets"
ON public.monthly_targets FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role) AND is_in_managed_team(auth.uid(), user_id));

CREATE POLICY "Managers see team member targets"
ON public.monthly_targets FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'gestor'::app_role) AND is_in_managed_team(auth.uid(), user_id));
