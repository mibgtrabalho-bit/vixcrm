import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatCurrency, getPeriodRange, isClosedInPeriod, sumField } from "@/lib/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Target, TrendingUp, Clock, Users, Layers } from "lucide-react";

interface ManagerDashboardProps {
  filters: { period: string; stage: string; team: string };
}

export function ManagerDashboard({ filters }: ManagerDashboardProps) {
  const { user, profile } = useAuth();
  const { start, end, monthStr } = useMemo(() => getPeriodRange(filters.period), [filters.period]);

  // 1. Get manager's team(s) and members
  const { data: teamData } = useQuery({
    queryKey: ["mgr-dash-teams", user?.id],
    queryFn: async () => {
      const { data: myTeams } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("user_id", user!.id);

      const teams = (myTeams || []).map((t: any) => ({ id: t.team_id, name: t.teams?.name || "" }));
      const teamIds = teams.map((t) => t.id);

      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, team_id")
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]);

      const memberUserIds = [...new Set((members || []).map((m: any) => m.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", memberUserIds.length > 0 ? memberUserIds : ["__none__"]);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", memberUserIds.length > 0 ? memberUserIds : ["__none__"]);

      const roleMap = Object.fromEntries((roles || []).map((r: any) => [r.user_id, r.role]));
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      const sellers = memberUserIds.filter((id) => roleMap[id] === "vendedor");

      return { teams, teamIds, sellers, allMemberIds: memberUserIds, profileMap, members: members || [] };
    },
    enabled: !!user?.id,
  });

  const sellers = teamData?.sellers || [];
  const allMemberIds = teamData?.allMemberIds || [];
  const profileMap = teamData?.profileMap || {};
  const teamIds = teamData?.teamIds || [];

  // 2. Opportunities — fetch all for team members (not just sellers), filter closing date client-side
  const { data: allOpportunities = [] } = useQuery({
    queryKey: ["mgr-dash-opps", allMemberIds.join(","), filters.stage],
    queryFn: async () => {
      if (allMemberIds.length === 0) return [];
      let q = supabase
        .from("opportunities")
        .select("id, title, value, value_saas, value_implantacao, stage, created_at, first_closed_at, updated_at, assigned_to, company_id, companies(name)")
        .in("assigned_to", allMemberIds);

      if (filters.stage !== "all") q = q.eq("stage", filters.stage as any);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: allMemberIds.length > 0,
  });

  // 3. Team target
  const { data: teamTarget } = useQuery({
    queryKey: ["mgr-dash-team-target", teamIds.join(","), monthStr],
    queryFn: async () => {
      if (teamIds.length === 0) return { target_saas: 0, target_setup: 0 };
      const { data } = await supabase
        .from("team_targets")
        .select("target_saas, target_setup")
        .in("team_id", teamIds)
        .eq("month", monthStr);
      let tSaas = 0, tSetup = 0;
      (data || []).forEach((t: any) => { tSaas += Number(t.target_saas) || 0; tSetup += Number(t.target_setup) || 0; });
      return { target_saas: tSaas, target_setup: tSetup };
    },
    enabled: teamIds.length > 0,
  });

  // Derived — uses canonical closing date via isClosedInPeriod
  const closed = useMemo(
    () => allOpportunities.filter((o: any) => o.stage === "fechado" && isClosedInPeriod(o, start, end)),
    [allOpportunities, start, end],
  );
  const pipeline = useMemo(
    () => allOpportunities.filter((o: any) => o.stage !== "fechado" && o.stage !== "perdido"),
    [allOpportunities],
  );

  const closedSaas = sumField(closed, "value_saas");
  const closedSetup = sumField(closed, "value_implantacao");
  const pipelineSaas = sumField(pipeline, "value_saas");
  const pipelineSetup = sumField(pipeline, "value_implantacao");

  const tSaas = teamTarget?.target_saas ?? 0;
  const tSetup = teamTarget?.target_setup ?? 0;
  const pctSaas = tSaas > 0 ? Math.min((closedSaas / tSaas) * 100, 100) : 0;
  const pctSetup = tSetup > 0 ? Math.min((closedSetup / tSetup) * 100, 100) : 0;

  const totalOpps = allOpportunities.length;
  const closedCount = closed.length;
  const conversion = totalOpps > 0 ? (closedCount / totalOpps) * 100 : 0;

  const avgCycleDays = useMemo(() => {
    const cycles = closed
      .filter((o: any) => o.first_closed_at && o.created_at)
      .map((o: any) => (new Date(o.first_closed_at).getTime() - new Date(o.created_at).getTime()) / 86400000);
    return cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;
  }, [closed]);

  // Seller performance
  const sellerPerf = useMemo(() => {
    return sellers.map((uid) => {
      const sellerOpps = allOpportunities.filter((o: any) => o.assigned_to === uid);
      const sellerClosed = sellerOpps.filter((o: any) => o.stage === "fechado" && isClosedInPeriod(o, start, end));
      const sellerPipeline = sellerOpps.filter((o: any) => o.stage !== "fechado" && o.stage !== "perdido");
      const closedVal = sumField(sellerClosed, "value");
      const pipelineVal = sumField(sellerPipeline, "value");
      const conv = sellerOpps.length > 0 ? (sellerClosed.length / sellerOpps.length) * 100 : 0;
      const avg = sellerClosed.length > 0 ? closedVal / sellerClosed.length : 0;
      return { userId: uid, name: profileMap[uid] || "—", opps: sellerOpps.length, pipelineVal, closedVal, closedCount: sellerClosed.length, conversion: conv, avgTicket: avg };
    }).sort((a, b) => b.closedVal - a.closedVal);
  }, [sellers, allOpportunities, profileMap, start, end]);

  // Stage distribution
  const stageMap = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach((s) => (map[s.id] = { count: 0, value: 0 }));
    allOpportunities.forEach((o: any) => {
      if (map[o.stage]) { map[o.stage].count += 1; map[o.stage].value += Number(o.value) || 0; }
    });
    return map;
  }, [allOpportunities]);

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
            <p className="text-2xl font-bold">{formatCurrency(tSaas)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {formatCurrency(closedSaas)}</span>
              <span>{pctSaas.toFixed(0)}%</span>
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
            <p className="text-2xl font-bold">{formatCurrency(tSetup)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {formatCurrency(closedSetup)}</span>
              <span>{pctSetup.toFixed(0)}%</span>
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
            <p className="text-xs text-muted-foreground mt-1">{closedCount}/{totalOpps} oportunidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ciclo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgCycleDays} dias</p>
            <p className="text-xs text-muted-foreground mt-1">{sellers.length} vendedor(es)</p>
          </CardContent>
        </Card>
      </div>

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
                <p className="text-xs text-muted-foreground">{formatCurrency(stageMap[s.id]?.value ?? 0)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seller performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Desempenho por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellerPerf.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum vendedor no time.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Opps</TableHead>
                    <TableHead className="text-right">Pipeline</TableHead>
                    <TableHead className="text-right">Fechado</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerPerf.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell className="text-sm font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-right">{s.opps}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(s.pipelineVal)}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(s.closedVal)}</TableCell>
                      <TableCell className="text-sm text-right">{s.conversion.toFixed(1).replace(".", ",")}%</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(s.avgTicket)}</TableCell>
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
