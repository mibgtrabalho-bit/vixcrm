import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";

interface TargetRow {
  id?: string;
  user_id: string;
  month: string;
  target_value: number;
  target_saas: number;
  target_setup: number;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
}

interface OpportunityRow {
  assigned_to: string;
  value_implantacao: number | null;
  value_saas: number | null;
  stage: string;
  first_closed_at: string | null;
  updated_at: string;
}

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

export default function Goals() {
  const { profile, role, user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [editSaas, setEditSaas] = useState<Record<string, string>>({});
  const [editSetup, setEditSetup] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = role === "gestor" || role === "diretor";
  const monthStr = getMonthStart(currentMonth);
  const monthEndStr = getMonthEnd(currentMonth);

  useEffect(() => {
    if (profile?.tenant_id) fetchData();
  }, [profile?.tenant_id, monthStr]);

  const fetchData = async () => {
    setLoading(true);

    const { data: targetData } = await supabase
      .from("monthly_targets")
      .select("id, user_id, month, target_value, target_saas, target_setup")
      .eq("month", monthStr);

    const { data: oppData } = await supabase
      .from("opportunities")
      .select("assigned_to, value_implantacao, value_saas, stage, first_closed_at, updated_at")
      .eq("stage", "fechado");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    setTargets(targetData || []);
    setOpportunities(oppData || []);
    setProfiles(profileData || []);

    const saasEdits: Record<string, string> = {};
    const setupEdits: Record<string, string> = {};
    (targetData || []).forEach((t: any) => {
      saasEdits[t.user_id] = String(t.target_saas ?? 0);
      setupEdits[t.user_id] = String(t.target_setup ?? 0);
    });
    setEditSaas(saasEdits);
    setEditSetup(setupEdits);
    setLoading(false);
  };

  const closedInMonth = useMemo(() => {
    return opportunities.filter((o) => {
      const closedDate = o.first_closed_at || o.updated_at;
      if (!closedDate) return false;
      const d = closedDate.slice(0, 10);
      return d >= monthStr && d <= monthEndStr;
    });
  }, [opportunities, monthStr, monthEndStr]);

  const visibleUsers = useMemo(() => {
    if (!user) return [];
    if (role === "vendedor") {
      return profiles.filter((p) => p.user_id === user.id);
    }
    return profiles;
  }, [profiles, user, role]);

  // Separate closed amounts per user: saas and setup
  const closedByUser = useMemo(() => {
    const map: Record<string, { saas: number; setup: number }> = {};
    closedInMonth.forEach((o) => {
      if (!map[o.assigned_to]) map[o.assigned_to] = { saas: 0, setup: 0 };
      map[o.assigned_to].saas += Number(o.value_saas) || 0;
      map[o.assigned_to].setup += Number(o.value_implantacao) || 0;
    });
    return map;
  }, [closedInMonth]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleSave = async () => {
    if (!profile?.tenant_id) return;
    setSaving(true);

    try {
      const allUserIds = new Set([...Object.keys(editSaas), ...Object.keys(editSetup)]);
      for (const userId of allUserIds) {
        const saasVal = parseFloat(editSaas[userId]) || 0;
        const setupVal = parseFloat(editSetup[userId]) || 0;
        const totalVal = saasVal + setupVal;
        const existing = targets.find((t) => t.user_id === userId);

        if (existing?.id) {
          await supabase
            .from("monthly_targets")
            .update({ target_saas: saasVal, target_setup: setupVal, target_value: totalVal })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("monthly_targets")
            .insert({
              tenant_id: profile.tenant_id,
              user_id: userId,
              month: monthStr,
              target_value: totalVal,
              target_saas: saasVal,
              target_setup: setupVal,
            });
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
          {canEdit && (
            <Button onClick={handleSave} disabled={saving} size="sm" className="ml-auto">
              <Save className="h-4 w-4 mr-1" />
              Salvar metas
            </Button>
          )}
        </div>

        {/* Targets table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : visibleUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum usuário encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
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
                {visibleUsers.map((u) => {
                  const saasTarget = parseFloat(editSaas[u.user_id] || "0") || 0;
                  const setupTarget = parseFloat(editSetup[u.user_id] || "0") || 0;
                  const closed = closedByUser[u.user_id] || { saas: 0, setup: 0 };
                  const saasAtt = saasTarget > 0 ? (closed.saas / saasTarget) * 100 : 0;
                  const setupAtt = setupTarget > 0 ? (closed.setup / setupTarget) * 100 : 0;

                  const attColor = (val: number) =>
                    val >= 100
                      ? "text-green-600 font-semibold"
                      : val >= 50
                      ? "text-amber-600 font-medium"
                      : "text-muted-foreground";

                  return (
                    <tr key={u.user_id} className="border-b border-border last:border-b-0 transition-apple hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{u.full_name}</td>
                      {/* SaaS */}
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            className="w-32 ml-auto text-right"
                            value={editSaas[u.user_id] ?? ""}
                            onChange={(e) =>
                              setEditSaas((prev) => ({ ...prev, [u.user_id]: e.target.value }))
                            }
                            placeholder="0"
                          />
                        ) : (
                          <span>{formatCurrency(saasTarget)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(closed.saas)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={attColor(saasAtt)}>{formatPercent(saasAtt)}</span>
                      </td>
                      {/* Setup */}
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            className="w-32 ml-auto text-right"
                            value={editSetup[u.user_id] ?? ""}
                            onChange={(e) =>
                              setEditSetup((prev) => ({ ...prev, [u.user_id]: e.target.value }))
                            }
                            placeholder="0"
                          />
                        ) : (
                          <span>{formatCurrency(setupTarget)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(closed.setup)}</td>
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
      </div>
    </AppLayout>
  );
}
