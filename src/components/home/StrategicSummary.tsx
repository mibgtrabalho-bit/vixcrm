import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/metrics";
import { ChevronDown, DollarSign, TrendingUp, Target, BarChart3, Hash, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategicSummaryProps {
  teamFilter: string;
}

async function resolveFilterUserIds(filterValue: string): Promise<string[] | null> {
  if (filterValue === "all") return null;
  if (filterValue.startsWith("user:")) return [filterValue.slice(5)];
  const teamId = filterValue.startsWith("team:") ? filterValue.slice(5) : filterValue;
  const { data } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
  const ids = (data || []).map((m) => m.user_id);
  return ids.length > 0 ? ids : [];
}

interface Stats {
  vendas_realizadas: number;
  vendas_projetadas: number;
  pipeline_saas: number;
  pipeline_setup: number;
  total_opps: number;
  conversao: number;
}

const EMPTY_STATS: Stats = {
  vendas_realizadas: 0,
  vendas_projetadas: 0,
  pipeline_saas: 0,
  pipeline_setup: 0,
  total_opps: 0,
  conversao: 0,
};

async function fetchStats(filterUserIds: string[] | null): Promise<Stats> {
  let query = supabase
    .from("opportunities")
    .select("id, value, value_implantacao, value_saas, stage");

  if (filterUserIds !== null) {
    if (filterUserIds.length === 0) return EMPTY_STATS;
    query = query.in("assigned_to", filterUserIds);
  }

  const { data: opps } = await query;
  const opportunities = opps || [];

  const fechados = opportunities.filter((o) => o.stage === "fechado");
  const pipeline = opportunities.filter((o) => o.stage !== "fechado" && o.stage !== "perdido");

  const vendasRealizadas = fechados.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const vendasProjetadas = pipeline.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const pipelineSaas = pipeline.reduce((s, o) => s + (Number(o.value_saas) || 0), 0);
  const pipelineSetup = pipeline.reduce((s, o) => s + (Number(o.value_implantacao) || 0), 0);

  const total = opportunities.length;
  const conversao = total > 0 ? (fechados.length / total) * 100 : 0;

  return {
    vendas_realizadas: vendasRealizadas,
    vendas_projetadas: vendasProjetadas,
    pipeline_saas: pipelineSaas,
    pipeline_setup: pipelineSetup,
    total_opps: total,
    conversao,
  };
}

interface KpiItem {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}

function buildKpis(role: string | null, values: Stats): KpiItem[] {
  if (role === "vendedor") {
    return [
      { label: "Minhas Vendas", value: formatCurrency(values.vendas_realizadas), icon: DollarSign, color: "text-emerald-600" },
      { label: "Meu Pipeline", value: formatCurrency(values.vendas_projetadas), icon: TrendingUp, color: "text-blue-600" },
      { label: "Setup", value: formatCurrency(values.pipeline_setup), icon: Target, color: "text-violet-600" },
      { label: "SaaS", value: formatCurrency(values.pipeline_saas), icon: BarChart3, color: "text-amber-600" },
    ];
  }

  if (role === "gestor") {
    return [
      { label: "Vendas do Time", value: formatCurrency(values.vendas_realizadas), icon: DollarSign, color: "text-emerald-600" },
      { label: "Pipeline", value: formatCurrency(values.vendas_projetadas), icon: TrendingUp, color: "text-blue-600" },
      { label: "Setup", value: formatCurrency(values.pipeline_setup), icon: Target, color: "text-violet-600" },
      { label: "SaaS", value: formatCurrency(values.pipeline_saas), icon: BarChart3, color: "text-amber-600" },
    ];
  }

  // Director: 6 KPIs with executive extras
  return [
    { label: "Vendas Realizadas", value: formatCurrency(values.vendas_realizadas), icon: DollarSign, color: "text-emerald-600" },
    { label: "Projetado", value: formatCurrency(values.vendas_projetadas), icon: TrendingUp, color: "text-blue-600" },
    { label: "Pipeline Setup", value: formatCurrency(values.pipeline_setup), icon: Target, color: "text-violet-600" },
    { label: "Pipeline SaaS", value: formatCurrency(values.pipeline_saas), icon: BarChart3, color: "text-amber-600" },
    { label: "Oportunidades", value: String(values.total_opps), icon: Hash, color: "text-sky-600" },
    { label: "Conversão", value: `${values.conversao.toFixed(1).replace(".", ",")}%`, icon: Percent, color: "text-rose-600" },
  ];
}

function getSummaryLabel(role: string | null): string {
  if (role === "vendedor") return "Meu Resumo";
  if (role === "gestor") return "Resumo do Time";
  return "Resumo Estratégico";
}

export function StrategicSummary({ teamFilter }: StrategicSummaryProps) {
  const { profile, role, user } = useAuth();

  // Sellers start collapsed for a leaner operational feel
  const [expanded, setExpanded] = useState(() => role !== "vendedor");
  const [filterUserIds, setFilterUserIds] = useState<string[] | null>(null);
  const [filterResolved, setFilterResolved] = useState(false);

  // Seller always scoped to self
  useEffect(() => {
    if (role === "vendedor" && user?.id) {
      setFilterUserIds([user.id]);
      setFilterResolved(true);
      return;
    }

    let cancelled = false;
    setFilterResolved(false);
    resolveFilterUserIds(teamFilter).then((ids) => {
      if (!cancelled) {
        setFilterUserIds(ids);
        setFilterResolved(true);
      }
    });
    return () => { cancelled = true; };
  }, [teamFilter, role, user?.id]);

  const { data: values } = useQuery({
    queryKey: ["home-strategic-stats", filterUserIds, role],
    queryFn: () => fetchStats(filterUserIds),
    enabled: !!profile?.tenant_id && filterResolved,
    staleTime: 30_000,
    initialData: EMPTY_STATS,
  });

  const kpis = buildKpis(role, values);
  const summaryLabel = getSummaryLabel(role);

  // Director uses 6-col grid, others use 4-col
  const gridCols = role === "diretor"
    ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
    : "grid-cols-2 md:grid-cols-4";

  return (
    <div className="border-b border-border/60">
      {/* Toggle row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-6 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !expanded && "-rotate-90")} />
        <span>{summaryLabel}</span>
        {/* Collapsed inline KPIs */}
        {!expanded && (
          <div className="ml-4 flex items-center gap-6 text-xs overflow-x-auto">
            {kpis.map((k) => (
              <span key={k.label} className="flex items-center gap-1 whitespace-nowrap">
                <span className="text-muted-foreground">{k.label}:</span>
                <span className="font-semibold text-foreground">{k.value}</span>
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded cards */}
      {expanded && (
        <div className={cn("grid gap-3 px-6 pb-4", gridCols)}>
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
            >
              <div className={cn("rounded-lg bg-muted p-2", kpi.color)}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                <p className="text-sm font-semibold truncate">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
