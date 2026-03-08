-- Drop the broad unique constraint that causes duplicate key errors on revoke
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_tenant_id_email_status_key;

-- Replace with a partial unique index: only one PENDING invite per tenant+email at a time
CREATE UNIQUE INDEX invitations_one_pending_per_email ON public.invitations (tenant_id, email) WHERE status = 'pending';