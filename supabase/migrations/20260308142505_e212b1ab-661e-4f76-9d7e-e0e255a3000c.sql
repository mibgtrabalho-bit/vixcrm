ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj text;

-- Allow directors to update tenant (cnpj field)
-- Policy already exists for directors to update tenant