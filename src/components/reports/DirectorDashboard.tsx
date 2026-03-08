import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PIPELINE_STAGES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Target, TrendingUp, Clock, Users, Layers, Building2, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface DirectorDashboardProps {
  filters: { period: string; stage: string; team: string };
}

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function getPeriodRange(period: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date, end: Date;
  switch (period) {
    case "last_month":
      start = new Date(y, m - 1, 1); end = new Date(y, m, 0, 23, 59, 59); break;
    case "current_quarter": {
      const q = Math.floor(m / 3) * 3;
      start = new Date(y, q, 1); end = new Date(y, q + 3, 0, 23, 59, 59); break;
    }
    case "current_year":
      start = new Date(y, 0, 1); end = new Date(y, 11, 31, 23, 59, 59); break;
    default:
      start = new Date(y, m, 1); end = new Date(y, m + 1, 0, 23, 59, 59);
  }
  const monthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end, monthStr };
}

export function DirectorDashboard({ filters }: DirectorDashboardProps) {
  const { user, profile } = useAuth();
  const { start, end, monthStr } = useMemo(() => getPeriodRange(filters.period), [filters.period]);

  // 1. Teams + members + profiles
  const { data: orgData } = useQuery({
    queryKey: ["dir-dash-org", profile?.tenant_id],
    queryFn: async () => {
      const [{ data: teams }, { data: members }, { data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("teams").select("id, name"),
        supabase.from("team_members").select("user_id, team_id"),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = Object.fromEntries((roles || []).map((r: any) => [r.user_id, r.role]));
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      const sellerIds = [...new Set((members || []).map((m: any) => m.user_id))].filter((id) => roleMap[id] === "vendedor");
      return { teams: teams || [], members: members || [], profileMap, roleMap, sellerIds };
    },
    enabled: !!profile?.tenant_id,
  });

  const teams = orgData?.teams || [];
  const members = orgData?.members || [];
  const profileMap = orgData?.profileMap || {};
  const sellerIds = orgData?.sellerIds || [];

  // Resolve filter scope
  const scopeUserIds = useMemo(() => {
    if (filters.team === "all") return sellerIds;
    if (filters.team.startsWith("user:")) return [filters.team.slice(5)];
    const teamId = filters.team.startsWith("team:") ? filters.team.slice(5) : filters.team;
    return members.filter((m: any) => m.team_id === teamId).map((m: any) => m.user_id).filter((id: string) => sellerIds.includes(id));
  }, [filters.team, sellerIds, members]);

  // 2. Opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ["dir-dash-opps", scopeUserIds.join(","), filters.period, filters.stage],
    queryFn: async () => {
      if (scopeUserIds.length === 0) return [];
      let q = supabase
        .from("opportunities")
        .select("id, title, value, value_saas, value_implantacao, stage, created_at, first_closed_at, assigned_to, company_id")
        .in("assigned_to", scopeUserIds)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      if (filters.stage !== "all") q = q.eq("stage", filters.stage as any);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: scopeUserIds.length > 0,
  });

  // 3. Targets — use monthly_targets for single seller, team_targets otherwise
  const { data: resolvedTargets } = useQuery({
    queryKey: ["dir-dash-targets", filters.team, monthStr],
    queryFn: async () => {
      if (filters.team.startsWith("user:")) {
        // Single seller → use their monthly_targets (same source as SellerDashboard)
        const userId = filters.team.slice(5);
        const { data } = await supabase
          .from("monthly_targets")
          .select("target_saas, target_setup")
          .eq("user_id", userId)
          .eq("month", monthStr)
          .maybeSingle();
        return { saas: Number(data?.target_saas) || 0, setup: Number(data?.target_setup) || 0 };
      }
      // Team or all → use team_targets
      let q = supabase.from("team_targets").select("team_id, target_saas, target_setup").eq("month", monthStr);
      if (filters.team !== "all") {
        const teamId = filters.team.startsWith("team:") ? filters.team.slice(5) : filters.team;
        q = q.eq("team_id", teamId);
      }
      const { data } = await q;
      const saas = (data || []).reduce((s: number, t: any) => s + (Number(t.target_saas) || 0), 0);
      const setup = (data || []).reduce((s: number, t: any) => s + (Number(t.target_setup) || 0), 0);
      return { saas, setup };
    },
    enabled: !!profile?.tenant_id,
  });

  // Derived
  const closed = useMemo(() => opportunities.filter((o: any) => o.stage === "fechado"), [opportunities]);
  const pipeline = useMemo(() => opportunities.filter((o: any) => o.stage !== "fechado" && o.stage !== "perdido"), [opportunities]);

  const closedSaas = closed.reduce((s: number, o: any) => s + (Number(o.value_saas) || 0), 0);
  const closedSetup = closed.reduce((s: number, o: any) => s + (Number(o.value_implantacao) || 0), 0);
  const pipelineTotal = pipeline.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0);

  const tSaas = (teamTargets || []).reduce((s: number, t: any) => s + (Number(t.target_saas) || 0), 0);
  const tSetup = (teamTargets || []).reduce((s: number, t: any) => s + (Number(t.target_setup) || 0), 0);
  const pctSaas = tSaas > 0 ? Math.min((closedSaas / tSaas) * 100, 100) : 0;
  const pctSetup = tSetup > 0 ? Math.min((closedSetup / tSetup) * 100, 100) : 0;

  const totalOpps = opportunities.length;
  const closedCount = closed.length;
  const conversion = totalOpps > 0 ? (closedCount / totalOpps) * 100 : 0;

  const avgCycleDays = useMemo(() => {
    const cycles = closed
      .filter((o: any) => o.first_closed_at && o.created_at)
      .map((o: any) => (new Date(o.first_closed_at).getTime() - new Date(o.created_at).getTime()) / 86400000);
    return cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;
  }, [closed]);

  // Monthly revenue chart data
  const monthlyRevenue = useMemo(() => {
    const map: Record<string, { month: string; saas: number; setup: number }> = {};
    closed.forEach((o: any) => {
      const d = new Date(o.first_closed_at || o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { month: key, saas: 0, setup: 0 };
      map[key].saas += Number(o.value_saas) || 0;
      map[key].setup += Number(o.value_implantacao) || 0;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [closed]);

  // Revenue by team
  const teamRevenue = useMemo(() => {
    const memberTeamMap: Record<string, string> = {};
    members.forEach((m: any) => { memberTeamMap[m.user_id] = m.team_id; });
    const teamNameMap = Object.fromEntries(teams.map((t: any) => [t.id, t.name]));

    const map: Record<string, { name: string; closed: number; count: number }> = {};
    closed.forEach((o: any) => {
      const tid = memberTeamMap[o.assigned_to] || "sem_time";
      const name = teamNameMap[tid] || "Sem time";
      if (!map[tid]) map[tid] = { name, closed: 0, count: 0 };
      map[tid].closed += Number(o.value) || 0;
      map[tid].count += 1;
    });
    return Object.values(map).sort((a, b) => b.closed - a.closed);
  }, [closed, members, teams]);

  // Seller ranking
  const sellerRanking = useMemo(() => {
    return scopeUserIds.map((uid) => {
      const so = opportunities.filter((o: any) => o.assigned_to === uid);
      const sc = so.filter((o: any) => o.stage === "fechado");
      const sp = so.filter((o: any) => o.stage !== "fechado" && o.stage !== "perdido");
      const closedVal = sc.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0);
      const pipelineVal = sp.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0);
      const conv = so.length > 0 ? (sc.length / so.length) * 100 : 0;
      return { userId: uid, name: profileMap[uid] || "—", opps: so.length, closedVal, pipelineVal, closedCount: sc.length, conversion: conv, avgTicket: sc.length > 0 ? closedVal / sc.length : 0 };
    }).sort((a, b) => b.closedVal - a.closedVal);
  }, [scopeUserIds, opportunities, profileMap]);

  // Stage map
  const stageMap = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach((s) => (map[s.id] = { count: 0, value: 0 }));
    opportunities.forEach((o: any) => {
      if (map[o.stage]) { map[o.stage].count += 1; map[o.stage].value += Number(o.value) || 0; }
    });
    return map;
  }, [opportunities]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta SaaS</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{fmt(tSaas)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {fmt(closedSaas)}</span><span>{pctSaas.toFixed(0)}%</span>
            </div>
            <Progress value={pctSaas} className="h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta Setup</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{fmt(tSetup)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {fmt(closedSetup)}</span><span>{pctSetup.toFixed(0)}%</span>
            </div>
            <Progress value={pctSetup} className="h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{conversion.toFixed(1).replace(".", ",")}%</p>
            <p className="text-xs text-muted-foreground mt-1">{closedCount}/{totalOpps} opps · Pipeline: {fmt(pipelineTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ciclo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgCycleDays} dias</p>
            <p className="text-xs text-muted-foreground mt-1">{scopeUserIds.length} vendedor(es) · {teams.length} time(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly revenue chart */}
      {monthlyRevenue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Receita Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="saas" name="SaaS" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="setup" name="Setup" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Pipeline by stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Pipeline por Estágio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {PIPELINE_STAGES.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/60 p-3 text-center">
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                <p className="text-lg font-bold mt-1">{stageMap[s.id]?.count ?? 0}</p>
                <p className="text-xs text-muted-foreground">{fmt(stageMap[s.id]?.value ?? 0)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by team */}
      {teamRevenue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Receita por Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Negócios</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamRevenue.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="font-medium text-sm">{t.name}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(t.closed)}</TableCell>
                      <TableCell className="text-sm text-right">{t.count}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(t.count > 0 ? t.closed / t.count : 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seller ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ranking de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellerRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum vendedor no escopo.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Opps</TableHead>
                    <TableHead className="text-right">Pipeline</TableHead>
                    <TableHead className="text-right">Fechado</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerRanking.map((s, i) => (
                    <TableRow key={s.userId}>
                      <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-right">{s.opps}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(s.pipelineVal)}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(s.closedVal)}</TableCell>
                      <TableCell className="text-sm text-right">{s.conversion.toFixed(1).replace(".", ",")}%</TableCell>
                      <TableCell className="text-sm text-right">{fmt(s.avgTicket)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
