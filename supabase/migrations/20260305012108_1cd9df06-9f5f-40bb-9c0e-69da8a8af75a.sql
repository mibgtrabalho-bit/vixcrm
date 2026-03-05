
-- Invitations table for user access management
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'vendedor',
  team_id uuid REFERENCES public.teams(id),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(tenant_id, email, status)
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Directors can manage all invitations in tenant
CREATE POLICY "Directors manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'diretor')
  )
  WITH CHECK (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'diretor')
  );

-- Managers can manage invitations for their own teams
CREATE POLICY "Managers manage team invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'gestor')
    AND team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'gestor')
    AND team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- Add is_active to profiles for deactivation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Trigger for updated_at
CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
