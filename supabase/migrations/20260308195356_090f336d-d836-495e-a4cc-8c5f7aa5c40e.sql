
-- 1. Create task_status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'completed', 'overdue', 'canceled');

-- 2. Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL,
  created_by UUID NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due ON public.tasks(due_at) WHERE status = 'pending';
CREATE INDEX idx_tasks_opportunity ON public.tasks(opportunity_id) WHERE opportunity_id IS NOT NULL;

-- 4. Auto-update updated_at
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies
CREATE POLICY "Directors see all tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers see team tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'gestor')
    AND is_in_managed_team(auth.uid(), assigned_to)
  );

CREATE POLICY "Sellers see own tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
  );

CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Directors can update all tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers can update team tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant(auth.uid())
    AND has_role(auth.uid(), 'gestor')
    AND is_in_managed_team(auth.uid(), assigned_to)
  );

CREATE POLICY "Sellers can update own tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND assigned_to = auth.uid());
