-- Add audit columns
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS revoked_by uuid;

-- Drop broken RESTRICTIVE policies
DROP POLICY IF EXISTS "Directors manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers manage team invitations" ON public.invitations;

-- Recreate as PERMISSIVE
CREATE POLICY "Directors manage invitations"
ON public.invitations FOR ALL TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers manage team invitations"
ON public.invitations FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
)
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);