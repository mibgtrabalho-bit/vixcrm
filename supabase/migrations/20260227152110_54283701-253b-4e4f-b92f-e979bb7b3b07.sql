
-- Update the handle_new_user trigger to also create the tenant automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _company_name TEXT;
BEGIN
  _company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  
  -- If tenant_id is provided in metadata, use it; otherwise create a new tenant
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    _tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  ELSE
    INSERT INTO public.tenants (name)
    VALUES (_company_name)
    RETURNING id INTO _tenant_id;
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    _tenant_id
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'vendedor')
  );
  
  RETURN NEW;
END;
$$;
