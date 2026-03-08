import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight, Save, Users } from "lucide-react";
import { toast } from "sonner";

function getMonthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function getMonthEnd(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function formatPercent(val: number): string {
  return val.toFixed(1).replace(".", ",") + "%";
}

function attColor(val: number): string {
  return val >= 100
    ? "text-green-600 font-semibold"
    : val >= 50
    ? "text-amber-600 font-medium"
    : "text-muted-foreground";
}

interface TeamRow {
  id: string;
  name: string;
}

interface TeamMemberRow {
  team_id: string;
  user_id: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

export default function Goals() {
  const { profile, role, user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [teamTargets, setTeamTargets] = useState<any[]>([]);
  const [sellerTargets, setSellerTargets] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Edit states - team target
  const [editTeamSaas, setEditTeamSaas] = useState("");
  const [editTeamSetup, setEditTeamSetup] = useState("");

  // Edit states - seller targets
  const [editSaas, setEditSaas] = useState<Record<string, string>>({});
  const [editSetup, setEditSetup] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const monthStr = getMonthStart(currentMonth);
  const monthEndStr = getMonthEnd(currentMonth);

  const isSeller = role === "vendedor";
  const isManager = role === "gestor";
  const isDirector = role === "diretor";

  // Available teams for selector
  const availableTeams = useMemo(() => {
    if (isDirector) return teams;
    if (isManager && user) {
      const myTeamIds = teamMembers.filter((tm) => tm.user_id === user.id).map((tm) => tm.team_id);
      return teams.filter((t) => myTeamIds.includes(t.id));
    }
    return [];
  }, [teams, teamMembers, role, user]);

  // Auto-select first team when available
  useEffect(() => {
    if (availableTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(availableTeams[0].id);
    }
  }, [availableTeams, selectedTeamId]);

  // Sellers in selected team (exclude gestors/directors - they don't get personal targets)
  const teamSellers = useMemo(() => {
    if (!selectedTeamId) return [];
    const memberUserIds = teamMembers
      .filter((tm) => tm.team_id === selectedTeamId)
      .map((tm) => tm.user_id);
    const managerOrDirectorIds = new Set(
      userRoles.filter((ur) => ur.role === "gestor" || ur.role === "diretor").map((ur) => ur.user_id)
    );
    return profiles.filter(
      (p) => memberUserIds.includes(p.user_id) && !managerOrDirectorIds.has(p.user_id)
    );
  }, [selectedTeamId, teamMembers, profiles, userRoles]);

  // Fetch all data
  useEffect(() => {
    if (profile?.tenant_id) fetchData();
  }, [profile?.tenant_id, monthStr]);

  const fetchData = async () => {
    setLoading(true);

    const [teamsRes, tmRes, profilesRes, oppsRes, sellerRes] = await Promise.all([
      supabase.from("teams").select("id, name"),
      supabase.from("team_members").select("team_id, user_id"),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("opportunities").select("assigned_to, value_implantacao, value_saas, stage, first_closed_at, updated_at").eq("stage", "fechado"),
      supabase.from("monthly_targets").select("id, user_id, month, target_value, target_saas, target_setup").eq("month", monthStr),
    ]);

    setTeams(teamsRes.data || []);
    setTeamMembers(tmRes.data || []);
    setProfiles(profilesRes.data || []);
    setOpportunities(oppsRes.data || []);
    setSellerTargets(sellerRes.data || []);

    if (!isSeller) {
      const [ttRes, rolesRes] = await Promise.all([
        supabase.from("team_targets" as any).select("id, team_id, month, target_saas, target_setup").eq("month", monthStr),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      setTeamTargets(ttRes.data || []);
      setUserRoles(rolesRes.data || []);
    }

    setLoading(false);
  };

  // Init edit states when team/data changes
  useEffect(() => {
    if (isSeller) return;
    if (!selectedTeamId) return;

    const tt = teamTargets.find((t: any) => t.team_id === selectedTeamId);
    setEditTeamSaas(String(tt?.target_saas ?? 0));
    setEditTeamSetup(String(tt?.target_setup ?? 0));

    const saasEdits: Record<string, string> = {};
    const setupEdits: Record<string, string> = {};
    sellerTargets.forEach((t: any) => {
      saasEdits[t.user_id] = String(t.target_saas ?? 0);
      setupEdits[t.user_id] = String(t.target_setup ?? 0);
    });
    setEditSaas(saasEdits);
    setEditSetup(setupEdits);
  }, [selectedTeamId, teamTargets, sellerTargets, isSeller]);

  // Closed opportunities in selected month
  const closedInMonth = useMemo(() => {
    return opportunities.filter((o) => {
      const closedDate = o.first_closed_at || o.updated_at;
      if (!closedDate) return false;
      const d = closedDate.slice(0, 10);
      return d >= monthStr && d <= monthEndStr;
    });
  }, [opportunities, monthStr, monthEndStr]);

  const closedByUser = useMemo(() => {
    const map: Record<string, { saas: number; setup: number }> = {};
    closedInMonth.forEach((o) => {
      if (!map[o.assigned_to]) map[o.assigned_to] = { saas: 0, setup: 0 };
      map[o.assigned_to].saas += Number(o.value_saas) || 0;
      map[o.assigned_to].setup += Number(o.value_implantacao) || 0;
    });
    return map;
  }, [closedInMonth]);

  // Team attainment: sum of all team members' closed amounts
  const teamAttainment = useMemo(() => {
    if (!selectedTeamId) return { saas: 0, setup: 0 };
    const memberIds = teamMembers
      .filter((tm) => tm.team_id === selectedTeamId)
      .map((tm) => tm.user_id);
    let saas = 0,
      setup = 0;
    memberIds.forEach((uid) => {
      const c = closedByUser[uid];
      if (c) {
        saas += c.saas;
        setup += c.setup;
      }
    });
    return { saas, setup };
  }, [selectedTeamId, teamMembers, closedByUser]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleSave = async () => {
    if (!profile?.tenant_id) return;
    setSaving(true);

    try {
      // Save team target (director only)
      if (isDirector && selectedTeamId) {
        const saasVal = parseFloat(editTeamSaas) || 0;
        const setupVal = parseFloat(editTeamSetup) || 0;
        const existing = teamTargets.find((t: any) => t.team_id === selectedTeamId);

        if (existing?.id) {
          await supabase
            .from("team_targets" as any)
            .update({ target_saas: saasVal, target_setup: setupVal })
            .eq("id", existing.id);
        } else {
          await supabase.from("team_targets" as any).insert({
            team_id: selectedTeamId,
            month: monthStr,
            target_saas: saasVal,
            target_setup: setupVal,
            tenant_id: profile.tenant_id,
          });
        }
      }

      // Save seller targets (director or manager)
      if ((isDirector || isManager) && selectedTeamId) {
        for (const seller of teamSellers) {
          const saasVal = parseFloat(editSaas[seller.user_id]) || 0;
          const setupVal = parseFloat(editSetup[seller.user_id]) || 0;
          const totalVal = saasVal + setupVal;
          const existing = sellerTargets.find((t: any) => t.user_id === seller.user_id);

          if (existing?.id) {
            await supabase
              .from("monthly_targets")
              .update({ target_saas: saasVal, target_setup: setupVal, target_value: totalVal })
              .eq("id", existing.id);
          } else {
            await supabase.from("monthly_targets").insert({
              tenant_id: profile.tenant_id,
              user_id: seller.user_id,
              month: monthStr,
              target_value: totalVal,
              target_saas: saasVal,
              target_setup: setupVal,
            });
          }
        }
      }

      toast.success("Metas salvas com sucesso!");
      fetchData();
    } catch {
      toast.error("Erro ao salvar metas.");
    } finally {
      setSaving(false);
    }
  };

  // ─── SELLER VIEW ─────────────────────────────────
  if (isSeller && user) {
    const myTarget = sellerTargets.find((t: any) => t.user_id === user.id);
    const myClosed = closedByUser[user.id] || { saas: 0, setup: 0 };
    const saasTarget = myTarget?.target_saas ?? 0;
    const setupTarget = myTarget?.target_setup ?? 0;
    const saasAtt = saasTarget > 0 ? (myClosed.saas / saasTarget) * 100 : 0;
    const setupAtt = setupTarget > 0 ? (myClosed.setup / setupTarget) * 100 : 0;

    return (
      <AppLayout>
        <PageHeader title="Metas" description="Acompanhe suas metas mensais de vendas" />
        <div className="p-6 space-y-6">
          {/* Month navigator */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-medium capitalize min-w-[180px] text-center">
              {formatMonthLabel(currentMonth)}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SaaS card */}
              <Card>
                <CardContent className="p-5 space-y-2">
                  <p className="text-sm text-muted-foreground">Meta SaaS</p>
                  <p className="text-2xl font-semibold">{formatCurrency(saasTarget)}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>Realizado: {formatCurrency(myClosed.saas)}</span>
                    <span className={attColor(saasAtt)}>{formatPercent(saasAtt)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(saasAtt, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
              {/* Setup card */}
              <Card>
                <CardContent className="p-5 space-y-2">
                  <p className="text-sm text-muted-foreground">Meta Setup</p>
                  <p className="text-2xl font-semibold">{formatCurrency(setupTarget)}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>Realizado: {formatCurrency(myClosed.setup)}</span>
                    <span className={attColor(setupAtt)}>{formatPercent(setupAtt)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(setupAtt, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ─── DIRECTOR / MANAGER VIEW ─────────────────────
  const teamSaasTarget = parseFloat(editTeamSaas) || 0;
  const teamSetupTarget = parseFloat(editTeamSetup) || 0;
  const teamSaasAtt = teamSaasTarget > 0 ? (teamAttainment.saas / teamSaasTarget) * 100 : 0;
  const teamSetupAtt = teamSetupTarget > 0 ? (teamAttainment.setup / teamSetupTarget) * 100 : 0;

  return (
    <AppLayout>
      <PageHeader title="Metas" description="Gerencie metas de times e vendedores" />

      <div className="p-6 space-y-6">
        {/* Top bar: month nav + team selector + save */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-medium capitalize min-w-[180px] text-center">
            {formatMonthLabel(currentMonth)}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Team selector */}
          {availableTeams.length > 1 ? (
            <Select
              value={selectedTeamId || ""}
              onValueChange={(val) => setSelectedTeamId(val)}
            >
              <SelectTrigger className="w-[200px] ml-2">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : availableTeams.length === 1 ? (
            <span className="ml-2 text-sm text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {availableTeams[0].name}
            </span>
          ) : null}

          <Button onClick={handleSave} disabled={saving} size="sm" className="ml-auto">
            <Save className="h-4 w-4 mr-1" />
            Salvar metas
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !selectedTeamId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum time encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Team target section */}
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
                  Meta do Time
                </h3>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Meta SaaS</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Realizado SaaS</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">% SaaS</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Meta Setup</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Realizado Setup</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">% Setup</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 font-medium">
                          {availableTeams.find((t) => t.id === selectedTeamId)?.name}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDirector ? (
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              className="w-32 ml-auto text-right"
                              value={editTeamSaas}
                              onChange={(e) => setEditTeamSaas(e.target.value)}
                              placeholder="0"
                            />
                          ) : (
                            <span>{formatCurrency(teamSaasTarget)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(teamAttainment.saas)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={attColor(teamSaasAtt)}>{formatPercent(teamSaasAtt)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDirector ? (
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              className="w-32 ml-auto text-right"
                              value={editTeamSetup}
                              onChange={(e) => setEditTeamSetup(e.target.value)}
                              placeholder="0"
                            />
                          ) : (
                            <span>{formatCurrency(teamSetupTarget)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(teamAttainment.setup)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={attColor(teamSetupAtt)}>{formatPercent(teamSetupAtt)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Seller targets section */}
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
                  Metas dos Vendedores
                </h3>
                {teamSellers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum vendedor neste time.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendedor</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Meta SaaS</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Realizado SaaS</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">% SaaS</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Meta Setup</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Realizado Setup</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">% Setup</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamSellers.map((seller) => {
                          const saasTarget = parseFloat(editSaas[seller.user_id] || "0") || 0;
                          const setupTarget = parseFloat(editSetup[seller.user_id] || "0") || 0;
                          const closed = closedByUser[seller.user_id] || { saas: 0, setup: 0 };
                          const saasAtt = saasTarget > 0 ? (closed.saas / saasTarget) * 100 : 0;
                          const setupAtt = setupTarget > 0 ? (closed.setup / setupTarget) * 100 : 0;

                          return (
                            <tr
                              key={seller.user_id}
                              className="border-b border-border last:border-b-0 transition-apple hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 font-medium">{seller.full_name}</td>
                              <td className="px-4 py-3 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step={100}
                                  className="w-32 ml-auto text-right"
                                  value={editSaas[seller.user_id] ?? ""}
                                  onChange={(e) =>
                                    setEditSaas((prev) => ({
                                      ...prev,
                                      [seller.user_id]: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatCurrency(closed.saas)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={attColor(saasAtt)}>{formatPercent(saasAtt)}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step={100}
                                  className="w-32 ml-auto text-right"
                                  value={editSetup[seller.user_id] ?? ""}
                                  onChange={(e) =>
                                    setEditSetup((prev) => ({
                                      ...prev,
                                      [seller.user_id]: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatCurrency(closed.setup)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={attColor(setupAtt)}>{formatPercent(setupAtt)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
