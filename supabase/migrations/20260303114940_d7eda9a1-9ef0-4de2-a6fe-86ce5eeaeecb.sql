
-- Monthly targets table
CREATE TABLE public.monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  month date NOT NULL, -- always 1st of month, e.g. '2026-03-01'
  target_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, month)
);

ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- Vendedor sees own targets
CREATE POLICY "Vendedor sees own targets"
ON public.monthly_targets FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND user_id = auth.uid()
);

-- Managers/Directors see all tenant targets
CREATE POLICY "Managers see tenant targets"
ON public.monthly_targets FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor'))
);

-- Managers/Directors can insert targets
CREATE POLICY "Managers can insert targets"
ON public.monthly_targets FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor'))
);

-- Managers/Directors can update targets
CREATE POLICY "Managers can update targets"
ON public.monthly_targets FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor'))
);

-- Updated_at trigger
CREATE TRIGGER update_monthly_targets_updated_at
  BEFORE UPDATE ON public.monthly_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
