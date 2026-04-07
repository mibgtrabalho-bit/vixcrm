CREATE TABLE public.oportunidade_notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oportunidade_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  conteudo TEXT NOT NULL CHECK (btrim(conteudo) <> ''),
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_oportunidade_notas_oportunidade_criado_em
  ON public.oportunidade_notas (oportunidade_id, criado_em DESC);

ALTER TABLE public.oportunidade_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes on visible opportunities"
ON public.oportunidade_notas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = oportunidade_id
      AND o.deleted_at IS NULL
      AND o.tenant_id = public.get_user_tenant(auth.uid())
  )
);

CREATE POLICY "Users can create notes on visible opportunities"
ON public.oportunidade_notas
FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = oportunidade_id
      AND o.deleted_at IS NULL
      AND o.tenant_id = public.get_user_tenant(auth.uid())
  )
);