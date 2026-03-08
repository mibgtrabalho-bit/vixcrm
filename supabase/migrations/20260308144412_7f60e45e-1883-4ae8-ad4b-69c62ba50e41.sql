
-- Fix profiles UPDATE: allow directors to update any tenant profile, managers to update seller profiles in their teams
-- First drop the restrictive self-only policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Self-update (own profile)
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Directors can update any tenant profile (e.g. deactivate)
CREATE POLICY "Directors can update tenant profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
)
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'diretor')
);

-- Managers can update only seller profiles in their teams
CREATE POLICY "Managers can update team seller profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND NOT has_role(user_id, 'gestor')
  AND NOT has_role(user_id, 'diretor')
  AND is_in_managed_team(auth.uid(), user_id)
)
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND NOT has_role(user_id, 'gestor')
  AND NOT has_role(user_id, 'diretor')
  AND is_in_managed_team(auth.uid(), user_id)
);
