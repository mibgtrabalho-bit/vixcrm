
-- 1. Create funnels table
CREATE TABLE public.funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create funnel_stages table
CREATE TABLE public.funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  key text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_won_stage boolean NOT NULL DEFAULT false,
  is_lost_stage boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funnel_id, key)
);

-- 3. Add funnel_id and funnel_stage_id to opportunities
ALTER TABLE public.opportunities
  ADD COLUMN funnel_id uuid REFERENCES public.funnels(id),
  ADD COLUMN funnel_stage_id uuid REFERENCES public.funnel_stages(id);

-- 4. Seed default funnel per tenant
INSERT INTO public.funnels (id, tenant_id, name, is_default, is_active, display_order)
SELECT gen_random_uuid(), t.id, 'Pipeline Principal', true, true, 0
FROM public.tenants t;

-- 5. Seed stages for each default funnel
INSERT INTO public.funnel_stages (funnel_id, tenant_id, name, key, display_order, is_won_stage, is_lost_stage)
SELECT f.id, f.tenant_id, s.name, s.key, s.display_order, s.is_won, s.is_lost
FROM public.funnels f
CROSS JOIN (VALUES
  ('Prospecção','prospeccao',0,false,false),
  ('Follow-up','follow_up',1,false,false),
  ('Agenda','agenda',2,false,false),
  ('Proposta','proposta',3,false,false),
  ('Negociação','negociacao',4,false,false),
  ('Fechado','fechado',5,true,false),
  ('Perdido','perdido',6,false,true)
) AS s(name, key, display_order, is_won, is_lost)
WHERE f.is_default = true;

-- 6. Backfill opportunities (fixed JOIN syntax)
UPDATE public.opportunities
SET funnel_id = f.id, funnel_stage_id = fs.id
FROM public.funnels f, public.funnel_stages fs
WHERE f.tenant_id = opportunities.tenant_id
  AND f.is_default = true
  AND fs.funnel_id = f.id
  AND fs.key = opportunities.stage::text;

-- 7. Enable RLS
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

-- 8. RLS for funnels
CREATE POLICY "Users can view tenant funnels"
  ON public.funnels FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Directors can manage funnels"
  ON public.funnels FOR ALL
  USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

-- 9. RLS for funnel_stages
CREATE POLICY "Users can view tenant funnel stages"
  ON public.funnel_stages FOR SELECT
  USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Directors can manage funnel stages"
  ON public.funnel_stages FOR ALL
  USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

-- 10. updated_at triggers
CREATE TRIGGER set_funnels_updated_at
  BEFORE UPDATE ON public.funnels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_funnel_stages_updated_at
  BEFORE UPDATE ON public.funnel_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
