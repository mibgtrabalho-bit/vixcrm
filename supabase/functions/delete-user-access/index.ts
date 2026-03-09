import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return res(401, { error: "Não autenticado" });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return res(401, { error: "Não autenticado" });

    const { target_user_id, target_invite_id } = await req.json();

    // Get caller profile + role
    const { data: callerProfile } = await admin
      .from("perfis")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .single();
    if (!callerProfile) return res(403, { error: "Perfil não encontrado" });

    const { data: callerRoleRow } = await admin
      .from("funcoes_de_usuario")
      .select("role")
      .eq("user_id", caller.id)
      .single();
    const callerRole = callerRoleRow?.role;

    if (callerRole !== "diretor" && callerRole !== "gestor") {
      return res(403, { error: "Sem permissão" });
    }

    // ── DELETE INVITE ──
    if (target_invite_id) {
      const { data: inv } = await admin
        .from("convites")
        .select("id, tenant_id, team_id, status")
        .eq("id", target_invite_id)
        .single();
      if (!inv || inv.tenant_id !== callerProfile.tenant_id) {
        return res(404, { error: "Convite não encontrado" });
      }
      // Manager can only delete invites for their teams
      if (callerRole === "gestor") {
        const { data: myTeams } = await admin
          .from("membros_da_equipe")
          .select("team_id")
          .eq("user_id", caller.id);
        const myTeamIds = new Set((myTeams || []).map((t: any) => t.team_id));
        if (!inv.team_id || !myTeamIds.has(inv.team_id)) {
          return res(403, { error: "Sem permissão para este convite" });
        }
      }
      // Revoke if pending, or hard delete if already revoked/accepted
      if (inv.status === "pending") {
        await admin
          .from("convites")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_by: caller.id,
          })
          .eq("id", inv.id);
      } else {
        await admin.from("convites").delete().eq("id", inv.id);
      }
      return res(200, { success: true, action: "invite_deleted" });
    }

    // ── DELETE USER ACCESS ──
    if (!target_user_id) {
      return res(400, { error: "target_user_id ou target_invite_id obrigatório" });
    }

    // Get target profile + role
    const { data: targetProfile } = await admin
      .from("perfis")
      .select("tenant_id, user_id, full_name")
      .eq("user_id", target_user_id)
      .single();
    if (!targetProfile || targetProfile.tenant_id !== callerProfile.tenant_id) {
      return res(404, { error: "Usuário não encontrado" });
    }

    const { data: targetRoleRow } = await admin
      .from("funcoes_de_usuario")
      .select("role")
      .eq("user_id", target_user_id)
      .single();
    const targetRole = targetRoleRow?.role;

    // Permission checks
    if (callerRole === "gestor") {
      if (targetRole === "gestor" || targetRole === "diretor") {
        return res(403, { error: "Gestor não pode excluir outro gestor ou diretor" });
      }
      // Check target is in manager's team
      const { data: inTeam } = await admin.rpc("is_in_managed_team", {
        _manager_id: caller.id,
        _target_user_id: target_user_id,
      });
      if (!inTeam) {
        return res(403, { error: "Usuário não pertence ao seu time" });
      }
    }

    // Find target's team
    const { data: targetTeams } = await admin
      .from("membros_da_equipe")
      .select("team_id")
      .eq("user_id", target_user_id);
    const targetTeamIds = (targetTeams || []).map((t: any) => t.team_id);

    // Get active opportunities assigned to target
    const { data: opps } = await admin
      .from("oportunidades")
      .select("id, stage")
      .eq("assigned_to", target_user_id)
      .eq("tenant_id", callerProfile.tenant_id)
      .is("deleted_at", null);

    // Get contacts created by target
    const { data: contacts } = await admin
      .from("contatos")
      .select("id")
      .eq("created_by", target_user_id)
      .eq("tenant_id", callerProfile.tenant_id)
      .is("deleted_at", null);

    let reassignment_info: any = { opportunities: 0, contacts: 0, reassigned: false, unassigned: false };
    reassignment_info.opportunities = (opps || []).length;
    reassignment_info.contacts = (contacts || []).length;

    // Find active sellers in the same team(s) excluding target
    let availableSellers: { user_id: string; opp_count: number }[] = [];
    if (targetTeamIds.length > 0) {
      const { data: teamMembers } = await admin
        .from("membros_da_equipe")
        .select("user_id")
        .in("team_id", targetTeamIds)
        .neq("user_id", target_user_id);

      const candidateIds = [...new Set((teamMembers || []).map((tm: any) => tm.user_id))];

      // Filter to active sellers only
      for (const uid of candidateIds) {
        const { data: prof } = await admin
          .from("perfis")
          .select("is_active")
          .eq("user_id", uid)
          .single();
        if (!prof?.is_active) continue;

        const { data: roleRow } = await admin
          .from("funcoes_de_usuario")
          .select("role")
          .eq("user_id", uid)
          .single();
        if (roleRow?.role !== "vendedor") continue;

        // Count active opportunities
        const { count } = await admin
          .from("oportunidades")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", uid)
          .eq("tenant_id", callerProfile.tenant_id)
          .is("deleted_at", null);

        availableSellers.push({ user_id: uid, opp_count: count || 0 });
      }
    }

    // Reassign opportunities
    if ((opps || []).length > 0 && availableSellers.length > 0) {
      // Sort by opp_count ascending for balanced assignment
      availableSellers.sort((a, b) => a.opp_count - b.opp_count);

      for (let i = 0; i < opps!.length; i++) {
        const seller = availableSellers[i % availableSellers.length];
        await admin
          .from("oportunidades")
          .update({ assigned_to: seller.user_id })
          .eq("id", opps![i].id);
        seller.opp_count++;
        // Re-sort after each assignment for balance
        availableSellers.sort((a, b) => a.opp_count - b.opp_count);
      }
      reassignment_info.reassigned = true;
    } else if ((opps || []).length > 0 && availableSellers.length === 0) {
      reassignment_info.unassigned = true;
      // Leave opportunities as-is (flagged for director review)
    }

    // Reassign contacts: transfer created_by to spread across sellers
    if ((contacts || []).length > 0 && availableSellers.length > 0) {
      // Reset counts for contact distribution
      const contactSellers = availableSellers.map((s) => ({ ...s, contact_count: 0 }));
      for (let i = 0; i < contacts!.length; i++) {
        const seller = contactSellers[i % contactSellers.length];
        await admin
          .from("contatos")
          .update({ created_by: seller.user_id })
          .eq("id", contacts![i].id);
      }
    }

    // Soft delete: deactivate profile + remove auth access
    await admin.from("perfis").update({ is_active: false }).eq("user_id", target_user_id);

    // Remove from teams
    await admin.from("membros_da_equipe").delete().eq("user_id", target_user_id);

    // Disable auth login by updating user metadata to mark as deleted
    // and setting a banned status
    await admin.auth.admin.updateUserById(target_user_id, {
      ban_duration: "876600h", // ~100 years
    });

    // Revoke any pending invitations for this email
    const { data: targetAuthUser } = await admin.auth.admin.getUserById(target_user_id);
    if (targetAuthUser?.user?.email) {
      await admin
        .from("convites")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: caller.id,
        })
        .eq("email", targetAuthUser.user.email)
        .eq("status", "pending");
    }

    return res(200, {
      success: true,
      action: "user_deleted",
      reassignment: reassignment_info,
    });
  } catch (e: any) {
    return res(500, { error: e.message });
  }
});

function res(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      "Content-Type": "application/json",
    },
  });
}
