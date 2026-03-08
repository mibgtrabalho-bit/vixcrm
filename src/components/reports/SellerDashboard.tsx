import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PIPELINE_STAGES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Target,
  DollarSign,
  TrendingUp,
  Clock,
  BarChart3,
  Layers,
} from "lucide-react";

interface SellerDashboardProps {
  filters: { period: string; stage: string; team: string };
}

function fmt(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function getPeriodRange(period: string): { start: Date; end: Date; monthStr: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let start: Date;
  let end: Date;

  switch (period) {
    case "last_month":
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59);
      break;
    case "current_quarter": {
      const qStart = Math.floor(m / 3) * 3;
      start = new Date(y, qStart, 1);
      end = new Date(y, qStart + 3, 0, 23, 59, 59);
      break;
    }
    case "current_year":
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59);
      break;
    default: // current_month
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
  }

  const monthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end, monthStr };
}

export function SellerDashboard({ filters }: SellerDashboardProps) {
  const { user, profile } = useAuth();
  const { start, end, monthStr } = useMemo(() => getPeriodRange(filters.period), [filters.period]);

  // Fetch all seller opportunities in period
  const { data: opportunities = [] } = useQuery({
    queryKey: ["seller-dash-opps", user?.id, filters.period, filters.stage],
    queryFn: async () => {
      let q = supabase
        .from("opportunities")
        .select("id, title, value, value_saas, value_implantacao, stage, created_at, first_closed_at, company_id, companies(name)")
        .eq("assigned_to", user!.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (filters.stage !== "all") {
        q = q.eq("stage", filters.stage);
      }

      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // Fetch target
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

  // Derived metrics
  const stageMap = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach((s) => (map[s.id] = { count: 0, value: 0 }));
    opportunities.forEach((o: any) => {
      if (map[o.stage]) {
        map[o.stage].count += 1;
        map[o.stage].value += Number(o.value) || 0;
      }
    });
    return map;
  }, [opportunities]);

  const closed = useMemo(() => opportunities.filter((o: any) => o.stage === "fechado"), [opportunities]);
  const pipeline = useMemo(() => opportunities.filter((o: any) => o.stage !== "fechado" && o.stage !== "perdido"), [opportunities]);

  const closedSaas = closed.reduce((s: number, o: any) => s + (Number(o.value_saas) || 0), 0);
  const closedSetup = closed.reduce((s: number, o: any) => s + (Number(o.value_implantacao) || 0), 0);
  const pipelineSaas = pipeline.reduce((s: number, o: any) => s + (Number(o.value_saas) || 0), 0);
  const pipelineSetup = pipeline.reduce((s: number, o: any) => s + (Number(o.value_implantacao) || 0), 0);

  const targetSaas = target?.target_saas ?? 0;
  const targetSetup = target?.target_setup ?? 0;
  const pctSaas = targetSaas > 0 ? Math.min((closedSaas / targetSaas) * 100, 100) : 0;
  const pctSetup = targetSetup > 0 ? Math.min((closedSetup / targetSetup) * 100, 100) : 0;

  const totalSold = closed.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0);
  const avgTicket = closed.length > 0 ? totalSold / closed.length : 0;

  // Average cycle
  const avgCycleDays = useMemo(() => {
    const cycles = closed
      .filter((o: any) => o.first_closed_at && o.created_at)
      .map((o: any) => {
        const diff = new Date(o.first_closed_at).getTime() - new Date(o.created_at).getTime();
        return diff / (1000 * 60 * 60 * 24);
      });
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
            <p className="text-2xl font-bold">{fmt(targetSaas)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {fmt(closedSaas)}</span>
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
            <p className="text-2xl font-bold">{fmt(targetSetup)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Realizado: {fmt(closedSetup)}</span>
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
            <p className="text-2xl font-bold">{fmt(pipelineSaas)}</p>
            <p className="text-xs text-muted-foreground mt-1">Setup: {fmt(pipelineSetup)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ciclo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgCycleDays} dias</p>
            <p className="text-xs text-muted-foreground mt-1">Ticket médio: {fmt(avgTicket)}</p>
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
                <p className="text-xs text-muted-foreground">{fmt(stageMap[s.id]?.value ?? 0)}</p>
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
              Total: {fmt(totalSold)} · Ticket médio: {fmt(avgTicket)} · {closed.length} venda(s)
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
                      <TableCell className="text-sm text-right">{fmt(Number(o.value) || 0)}</TableCell>
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
