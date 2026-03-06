-- Allow Directors to manage team_members (INSERT, UPDATE, DELETE)
CREATE POLICY "Directors can insert team members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'diretor')
  AND team_id IN (SELECT id FROM public.teams WHERE tenant_id = get_user_tenant(auth.uid()))
);

CREATE POLICY "Directors can update team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'diretor')
  AND team_id IN (SELECT id FROM public.teams WHERE tenant_id = get_user_tenant(auth.uid()))
);

CREATE POLICY "Directors can delete team members"
ON public.team_members
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'diretor')
  AND team_id IN (SELECT id FROM public.teams WHERE tenant_id = get_user_tenant(auth.uid()))
);
