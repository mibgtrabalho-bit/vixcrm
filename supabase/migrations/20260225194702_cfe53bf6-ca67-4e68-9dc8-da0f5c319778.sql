
-- Allow unauthenticated tenant creation during signup
CREATE POLICY "Anyone can create tenants" ON public.tenants
  FOR INSERT WITH CHECK (true);

-- Allow directors to update their tenant
CREATE POLICY "Directors can update tenant" ON public.tenants
  FOR UPDATE USING (
    id = public.get_user_tenant(auth.uid()) AND
    public.has_role(auth.uid(), 'diretor')
  );
