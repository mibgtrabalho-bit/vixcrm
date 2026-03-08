CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
  _company_name TEXT;
  _invite_token TEXT;
  _team_id UUID;
BEGIN
  _company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  _invite_token := NEW.raw_user_meta_data->>'invite_token';
  
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

  -- If team_id provided, add to team
  _team_id := NULLIF(NEW.raw_user_meta_data->>'team_id', '');
  IF _team_id IS NOT NULL THEN
    INSERT INTO public.team_members (user_id, team_id)
    VALUES (NEW.id, _team_id);
  END IF;

  -- If invite token provided, mark as accepted
  IF _invite_token IS NOT NULL AND _invite_token != '' THEN
    UPDATE public.invitations
    SET status = 'accepted'
    WHERE token = _invite_token AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$function$;