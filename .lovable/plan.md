

## Root Cause

All RLS policies on `invitations` are **RESTRICTIVE**. PostgreSQL requires at least one **PERMISSIVE** policy to grant base access; RESTRICTIVE policies only narrow existing access. With zero PERMISSIVE policies, every SELECT/INSERT/UPDATE is denied — including the revoke update.

## Exact Changes

### 1. Database migration — fix invitations RLS + add audit columns

```sql
-- Add revoked_at / revoked_by columns
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS revoked_by uuid;

-- Drop the two broken RESTRICTIVE policies
DROP POLICY IF EXISTS "Directors manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Managers manage team invitations" ON public.invitations;

-- Recreate as PERMISSIVE
CREATE POLICY "Directors manage invitations"
ON public.invitations FOR ALL TO authenticated
USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'))
WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(), 'diretor'));

CREATE POLICY "Managers manage team invitations"
ON public.invitations FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
)
WITH CHECK (
  tenant_id = get_user_tenant(auth.uid())
  AND has_role(auth.uid(), 'gestor')
  AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
```

### 2. UI — update `revokeInvite` to set audit fields

In `AccessManagement.tsx`, change the `revokeInvite` function to also write `revoked_at` and `revoked_by`:

```typescript
const revokeInvite = async (id: string) => {
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user?.id })
    .eq("id", id);
  // ... toast + fetchAll
};
```

No other files or flows are changed.

## Test Checklist

1. **Director lists invitations** — Go to Settings → Gestão de Acessos → Convites tab; confirm pending invitations load.
2. **Revoke works** — Click the revoke (X) button on a pending invite; confirm status changes to "Revogado" and the action buttons update.
3. **Revoked invite unusable** — Copy the revoked invite's link and open in incognito; confirm signup with that token does NOT link to the tenant (current Auth.tsx ignores tokens entirely, so this is already blocked).
4. **Manager can revoke own team invites** — Log in as Manager; confirm they can see and revoke invitations for their team only.

