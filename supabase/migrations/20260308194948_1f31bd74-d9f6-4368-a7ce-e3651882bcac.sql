
-- 1. Create opportunity_stage_history table
CREATE TABLE public.opportunity_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_stage public.pipeline_stage,
  to_stage public.pipeline_stage NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index for fast lookups
CREATE INDEX idx_stage_history_opp ON public.opportunity_stage_history(opportunity_id);
CREATE INDEX idx_stage_history_tenant ON public.opportunity_stage_history(tenant_id);

-- 3. Enable RLS
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (read-only, mirror opportunity visibility)
CREATE POLICY "Directors see all stage history"
  ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers see team stage history"
  ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'gestor')
    AND opportunity_id IN (
      SELECT id FROM public.opportunities WHERE is_in_managed_team(auth.uid(), assigned_to)
    )
  );

CREATE POLICY "Sellers see own stage history"
  ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND opportunity_id IN (
      SELECT id FROM public.opportunities WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

-- Internal insert policy (trigger runs as SECURITY DEFINER, but allow authenticated insert for safety)
CREATE POLICY "System can insert stage history"
  ON public.opportunity_stage_history FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- 5. Trigger function to record stage changes
CREATE OR REPLACE FUNCTION public.record_stage_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.opportunity_stage_history (tenant_id, opportunity_id, from_stage, to_stage, changed_by)
    VALUES (NEW.tenant_id, NEW.id, OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Attach trigger
CREATE TRIGGER trg_record_stage_change
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.record_stage_change();
