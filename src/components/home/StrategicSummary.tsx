import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/metrics";
import { ChevronDown, DollarSign, TrendingUp, Target, BarChart3 } from "lucide-react";
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

async function fetchStats(filterUserIds: string[] | null) {
  const empty = { vendas_realizadas: 0, vendas_projetadas: 0, pipeline_saas: 0, pipeline_setup: 0 };
  let query = supabase
    .from("opportunities")
    .select("id, value, value_implantacao, value_saas, stage");

  if (filterUserIds !== null) {
    if (filterUserIds.length === 0) return empty;
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

  return { vendas_realizadas: vendasRealizadas, vendas_projetadas: vendasProjetadas, pipeline_saas: pipelineSaas, pipeline_setup: pipelineSetup };
}

export function StrategicSummary({ teamFilter }: StrategicSummaryProps) {
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [filterUserIds, setFilterUserIds] = useState<string[] | null>(null);
  const [filterResolved, setFilterResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFilterResolved(false);
    resolveFilterUserIds(teamFilter).then((ids) => {
      if (!cancelled) {
        setFilterUserIds(ids);
        setFilterResolved(true);
      }
    });
    return () => { cancelled = true; };
  }, [teamFilter]);

  const { data: values } = useQuery({
    queryKey: ["home-strategic-stats", filterUserIds],
    queryFn: () => fetchStats(filterUserIds),
    enabled: !!profile?.tenant_id && filterResolved,
    staleTime: 30_000,
    initialData: { vendas_realizadas: 0, vendas_projetadas: 0, pipeline_saas: 0, pipeline_setup: 0 },
  });

  const kpis = [
    { label: "Vendas Realizadas", value: formatCurrency(values.vendas_realizadas), icon: DollarSign, color: "text-emerald-600" },
    { label: "Projetado", value: formatCurrency(values.vendas_projetadas), icon: TrendingUp, color: "text-blue-600" },
    { label: "Pipeline Setup", value: formatCurrency(values.pipeline_setup), icon: Target, color: "text-violet-600" },
    { label: "Pipeline SaaS", value: formatCurrency(values.pipeline_saas), icon: BarChart3, color: "text-amber-600" },
  ];

  return (
    <div className="border-b border-border/60">
      {/* Toggle row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-6 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !expanded && "-rotate-90")} />
        <span>Resumo Estratégico</span>
        {/* Collapsed inline KPIs */}
        {!expanded && (
          <div className="ml-4 flex items-center gap-6 text-xs">
            {kpis.map((k) => (
              <span key={k.label} className="flex items-center gap-1">
                <span className="text-muted-foreground">{k.label}:</span>
                <span className="font-semibold text-foreground">{k.value}</span>
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded cards */}
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-4">
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
