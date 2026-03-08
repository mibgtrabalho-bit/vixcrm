-- Fix teams: drop RESTRICTIVE, recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view tenant teams" ON public.teams;
DROP POLICY IF EXISTS "Directors can manage teams" ON public.teams;

CREATE POLICY "Users can view tenant teams"
ON public.teams FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Directors can manage teams"
ON public.teams FOR ALL TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

-- Fix team_members: drop RESTRICTIVE, recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Directors can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Directors can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Directors can delete team members" ON public.team_members;

CREATE POLICY "Users can view team members"
ON public.team_members FOR SELECT TO authenticated
USING (team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

CREATE POLICY "Directors can insert team members"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'diretor') AND team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

CREATE POLICY "Directors can update team members"
ON public.team_members FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'diretor') AND team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));

CREATE POLICY "Directors can delete team members"
ON public.team_members FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'diretor') AND team_id IN (SELECT id FROM teams WHERE tenant_id = get_user_tenant(auth.uid())));