CREATE TABLE public.opportunity_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  actor_id UUID,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_opportunity_activity_log_opportunity_created_at
  ON public.opportunity_activity_log (opportunity_id, created_at DESC);

ALTER TABLE public.opportunity_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity logs on visible opportunities"
ON public.opportunity_activity_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = opportunity_id
      AND o.tenant_id = public.get_user_tenant(auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.log_opportunity_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.opportunity_activity_log (opportunity_id, actor_id, event_type, metadata, created_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.deleted_by, auth.uid()),
      'opportunity_deleted',
      jsonb_build_object(),
      COALESCE(NEW.deleted_at, now())
    );
  END IF;

  IF OLD.value_implantacao IS DISTINCT FROM NEW.value_implantacao
     OR OLD.value_saas IS DISTINCT FROM NEW.value_saas THEN
    INSERT INTO public.opportunity_activity_log (opportunity_id, actor_id, event_type, metadata)
    VALUES (
      NEW.id,
      auth.uid(),
      'value_updated',
      jsonb_build_object(
        'old_value_implantacao', OLD.value_implantacao,
        'new_value_implantacao', NEW.value_implantacao,
        'old_value_saas', OLD.value_saas,
        'new_value_saas', NEW.value_saas
      )
    );
  END IF;

  IF OLD.proxima_acao_tipo IS DISTINCT FROM NEW.proxima_acao_tipo
     OR OLD.proxima_acao_data IS DISTINCT FROM NEW.proxima_acao_data THEN
    INSERT INTO public.opportunity_activity_log (opportunity_id, actor_id, event_type, metadata)
    VALUES (
      NEW.id,
      auth.uid(),
      'next_action_updated',
      jsonb_build_object(
        'old_tipo', OLD.proxima_acao_tipo,
        'new_tipo', NEW.proxima_acao_tipo,
        'old_data', OLD.proxima_acao_data,
        'new_data', NEW.proxima_acao_data
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_opportunity_activity ON public.opportunities;
CREATE TRIGGER trg_log_opportunity_activity
AFTER UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.log_opportunity_activity();

DROP TRIGGER IF EXISTS trg_record_opportunity_stage_change ON public.opportunities;
CREATE TRIGGER trg_record_opportunity_stage_change
AFTER UPDATE OF stage ON public.opportunities
FOR EACH ROW
WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
EXECUTE FUNCTION public.record_stage_change();