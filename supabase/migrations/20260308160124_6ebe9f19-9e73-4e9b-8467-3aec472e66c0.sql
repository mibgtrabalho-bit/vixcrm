
-- Force PostgREST to reload schema cache (picks up new RLS policies)
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
