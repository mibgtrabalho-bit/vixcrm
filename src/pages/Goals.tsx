import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight, Target, Save } from "lucide-react";
import { toast } from "sonner";

interface TargetRow {
  id?: string;
  user_id: string;
  month: string;
  target_value: number;
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
  const { profile, role } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const canEdit = role === "gestor" || role === "diretor";
  const monthStr = getMonthStart(currentMonth);
  const monthEndStr = getMonthEnd(currentMonth);

  useEffect(() => {
    if (profile?.tenant_id) fetchData();
  }, [profile?.tenant_id, monthStr]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch targets for this month
    const { data: targetData } = await supabase
      .from("monthly_targets")
      .select("id, user_id, month, target_value")
      .eq("month", monthStr);

    // Fetch closed opportunities for this month using server-side filters
    // We filter by first_closed_at within the month range, OR stage=fechado + updated_at in range (for backfill)
    const { data: oppData } = await supabase
      .from("opportunities")
      .select("assigned_to, value_implantacao, value_saas, stage, first_closed_at, updated_at")
      .eq("stage", "fechado");

    // Fetch tenant profiles (for name display)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    setTargets(targetData || []);
    setOpportunities(oppData || []);
    setProfiles(profileData || []);

    // Init edit values from targets
    const edits: Record<string, string> = {};
    (targetData || []).forEach((t) => {
      edits[t.user_id] = String(t.target_value);
    });
    setEditValues(edits);
    setLoading(false);
  };

  // Filter closed opportunities to only those closed in the selected month
  const closedInMonth = useMemo(() => {
    return opportunities.filter((o) => {
      // Use first_closed_at if available, otherwise fall back to updated_at for historical data
      const closedDate = o.first_closed_at || o.updated_at;
      if (!closedDate) return false;
      const d = closedDate.slice(0, 10); // YYYY-MM-DD
      return d >= monthStr && d <= monthEndStr;
    });
  }, [opportunities, monthStr, monthEndStr]);

  // Determine which users to show based on role
  const visibleUsers = useMemo(() => {
    if (!user) return [];
    if (role === "vendedor") {
      return profiles.filter((p) => p.user_id === user.id);
    }
    // gestor/diretor see all tenant profiles (RLS already scopes)
    return profiles;
  }, [profiles, user, role]);

  // Calculate closed amount per user for the month
  const closedByUser = useMemo(() => {
    const map: Record<string, number> = {};
    closedInMonth.forEach((o) => {
      const amount = (Number(o.value_implantacao) || 0) + (Number(o.value_saas) || 0);
      map[o.assigned_to] = (map[o.assigned_to] || 0) + amount;
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
      for (const userId of Object.keys(editValues)) {
        const val = parseFloat(editValues[userId]) || 0;
        const existing = targets.find((t) => t.user_id === userId);

        if (existing?.id) {
          await supabase
            .from("monthly_targets")
            .update({ target_value: val })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("monthly_targets")
            .insert({
              tenant_id: profile.tenant_id,
              user_id: userId,
              month: monthStr,
              target_value: val,
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
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendedor</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Meta</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Realizado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Atingimento</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const targetVal = parseFloat(editValues[user.user_id] || "0") || 0;
                  const closedVal = closedByUser[user.user_id] || 0;
                  const attainment = targetVal > 0 ? (closedVal / targetVal) * 100 : 0;

                  return (
                    <tr key={user.user_id} className="border-b border-border last:border-b-0 transition-apple hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{user.full_name}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            className="w-36 ml-auto text-right"
                            value={editValues[user.user_id] ?? ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [user.user_id]: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        ) : (
                          <span>{formatCurrency(targetVal)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(closedVal)}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            attainment >= 100
                              ? "text-green-600 font-semibold"
                              : attainment >= 50
                              ? "text-amber-600 font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {formatPercent(attainment)}
                        </span>
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
