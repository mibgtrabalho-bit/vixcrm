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
import { Target, DollarSign, TrendingUp, Clock, Layers } from "lucide-react";

interface SellerDashboardProps {
  filters: { period: string; stage: string; team: string };
}

export function SellerDashboard({ filters }: SellerDashboardProps) {
  const { user } = useAuth();
  const { start, end, monthStr } = useMemo(() => getPeriodRange(filters.period), [filters.period]);

  // Fetch all seller opportunities (no created_at filter — we filter closing date client-side)
  const { data: allOpportunities = [] } = useQuery({
    queryKey: ["seller-dash-opps", user?.id, filters.stage],
    queryFn: async () => {
      let q = supabase
        .from("opportunities")
        .select("id, title, value, value_saas, value_implantacao, stage, created_at, first_closed_at, updated_at, company_id, companies(name)")
        .eq("assigned_to", user!.id);

      if (filters.stage !== "all") {
        q = q.eq("stage", filters.stage as any);
      }

      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // Fetch target (same source as Goals page: monthly_targets)
  const { data: target } = useQuery({
    queryKey: ["seller-dash-target", user?.id, monthStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_targets")
        .select("target_saas, target_setup")
        .eq("user_id", user!.id)
        .eq("month", monthStr)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Closed in period — uses canonical closing date (first_closed_at || updated_at)
  const closed = useMemo(
    () => allOpportunities.filter((o: any) => o.stage === "fechado" && isClosedInPeriod(o, start, end)),
    [allOpportunities, start, end],
  );

  // Active pipeline (no period filter — shows current state)
  const pipeline = useMemo(
    () => allOpportunities.filter((o: any) => o.stage !== "fechado" && o.stage !== "perdido"),
    [allOpportunities],
  );

  // Stage distribution (all opps, regardless of period, for pipeline visibility)
  const stageMap = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach((s) => (map[s.id] = { count: 0, value: 0 }));
    allOpportunities.forEach((o: any) => {
      if (map[o.stage]) {
        map[o.stage].count += 1;
        map[o.stage].value += Number(o.value) || 0;
      }
    });
    return map;
  }, [allOpportunities]);

  const closedSaas = sumField(closed, "value_saas");
  const closedSetup = sumField(closed, "value_implantacao");
  const pipelineSaas = sumField(pipeline, "value_saas");
  const pipelineSetup = sumField(pipeline, "value_implantacao");

  const targetSaas = target?.target_saas ?? 0;
  const targetSetup = target?.target_setup ?? 0;
  const pctSaas = targetSaas > 0 ? Math.min((closedSaas / targetSaas) * 100, 100) : 0;
  const pctSetup = targetSetup > 0 ? Math.min((closedSetup / targetSetup) * 100, 100) : 0;

  const totalSold = sumField(closed, "value");
  const avgTicket = closed.length > 0 ? totalSold / closed.length : 0;

  const avgCycleDays = useMemo(() => {
    const cycles = closed
      .filter((o: any) => o.first_closed_at && o.created_at)
      .map((o: any) => (new Date(o.first_closed_at).getTime() - new Date(o.created_at).getTime()) / 86400000);
    return cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;
  }, [closed]);

  return (
    <div className="space-y-6">
      {/* 1. Target cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta SaaS</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{formatCurrency(targetSaas)}</p>
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
            <p className="text-2xl font-bold">{formatCurrency(targetSetup)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {formatCurrency(closedSetup)}</span>
              <span>{pctSetup.toFixed(0)}%</span>
            </div>
            <Progress value={pctSetup} className="h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline SaaS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(pipelineSaas)}</p>
            <p className="text-xs text-muted-foreground mt-1">Setup: {formatCurrency(pipelineSetup)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ciclo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgCycleDays} dias</p>
            <p className="text-xs text-muted-foreground mt-1">Ticket médio: {formatCurrency(avgTicket)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Opportunities by stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Oportunidades por Estágio
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

      {/* 3. Closed sales table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Vendas Realizadas
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Total: {formatCurrency(totalSold)} · Ticket médio: {formatCurrency(avgTicket)} · {closed.length} venda(s)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda fechada no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Oportunidade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Data Fech.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closed.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{o.companies?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{o.title}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(Number(o.value) || 0)}</TableCell>
                      <TableCell className="text-sm text-right">
                        {o.first_closed_at
                          ? new Date(o.first_closed_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
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
