import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/metrics";
import { parsePipelineFilter } from "@/components/pipeline/PipelineTeamFilter";
import { ChevronDown, Target, CheckCircle2, TrendingUp, AlertTriangle, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategicSummaryProps {
  teamFilter: string;
}

// ── helpers ─────────────────────────────────────────

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function resolveFilterUserIds(filterValue: string): Promise<string[] | null> {
  if (filterValue === "all") return null;
  if (filterValue.startsWith("user:")) return [filterValue.slice(5)];
  const teamId = filterValue.startsWith("team:") ? filterValue.slice(5) : filterValue;
  const { data } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
  const ids = (data || []).map((m) => m.user_id);
  return ids.length > 0 ? ids : [];
}

// ── data types ──────────────────────────────────────

interface SummaryData {
  metaSaas: number;
  metaSetup: number;
  fechadoSetup: number;
  fechadoSaas: number;
  pipelineSetup: number;
  pipelineSaas: number;
  conversao: number;
  staleCount: number;
  totalOpps: number;
}

const EMPTY: SummaryData = {
  metaSaas: 0, metaSetup: 0,
  fechadoSetup: 0, fechadoSaas: 0,
  pipelineSetup: 0, pipelineSaas: 0,
  conversao: 0, staleCount: 0, totalOpps: 0,
};

const STALE_DAYS = 7;

async function fetchSummaryData(
  filterUserIds: string[] | null,
  teamFilter: string,
  role: string | null,
  userId: string | null,
  monthStr: string,
): Promise<SummaryData> {
  if (filterUserIds !== null && filterUserIds.length === 0) return EMPTY;

  // 1. Opportunities
  let oppQuery = supabase
    .from("opportunities")
    .select("id, value_implantacao, value_saas, stage, last_activity_at");

  if (filterUserIds !== null) {
    oppQuery = oppQuery.in("assigned_to", filterUserIds);
  }

  const { data: opps } = await oppQuery;
  const opportunities = opps || [];

  const fechados = opportunities.filter((o) => o.stage === "fechado");
  const pipeline = opportunities.filter((o) => o.stage !== "fechado" && o.stage !== "perdido");
  const active = opportunities.filter((o) => o.stage !== "perdido");

  const fechadoSetup = fechados.reduce((s, o) => s + (Number(o.value_implantacao) || 0), 0);
  const fechadoSaas = fechados.reduce((s, o) => s + (Number(o.value_saas) || 0), 0);
  const pipelineSetup = pipeline.reduce((s, o) => s + (Number(o.value_implantacao) || 0), 0);
  const pipelineSaas = pipeline.reduce((s, o) => s + (Number(o.value_saas) || 0), 0);

  const totalActive = active.length;
  const conversao = totalActive > 0 ? (fechados.length / totalActive) * 100 : 0;

  // Stale: pipeline opps with no activity in 7+ days
  const staleThreshold = Date.now() - STALE_DAYS * 86400000;
  const staleCount = pipeline.filter((o) => {
    if (!o.last_activity_at) return true;
    return new Date(o.last_activity_at).getTime() < staleThreshold;
  }).length;

  // 2. Targets
  const filter = parsePipelineFilter(teamFilter);
  let metaSaas = 0;
  let metaSetup = 0;

  if (role === "vendedor" && userId) {
    const { data } = await supabase
      .from("monthly_targets")
      .select("target_saas, target_setup")
      .eq("user_id", userId)
      .eq("month", monthStr)
      .maybeSingle();
    metaSaas = data?.target_saas ?? 0;
    metaSetup = data?.target_setup ?? 0;
  } else if (filter.type === "user" && filter.id) {
    const { data } = await supabase
      .from("monthly_targets")
      .select("target_saas, target_setup")
      .eq("user_id", filter.id)
      .eq("month", monthStr)
      .maybeSingle();
    metaSaas = data?.target_saas ?? 0;
    metaSetup = data?.target_setup ?? 0;
  } else if (filter.type === "team" && filter.id) {
    const { data } = await supabase
      .from("team_targets" as any)
      .select("target_saas, target_setup")
      .eq("team_id", filter.id)
      .eq("month", monthStr)
      .maybeSingle();
    metaSaas = (data as any)?.target_saas ?? 0;
    metaSetup = (data as any)?.target_setup ?? 0;
  } else if (filter.type === "all") {
    const { data } = await supabase
      .from("team_targets" as any)
      .select("target_saas, target_setup")
      .eq("month", monthStr);
    (data || []).forEach((t: any) => {
      metaSaas += Number(t.target_saas) || 0;
      metaSetup += Number(t.target_setup) || 0;
    });
  }

  return {
    metaSaas, metaSetup,
    fechadoSetup, fechadoSaas,
    pipelineSetup, pipelineSaas,
    conversao, staleCount,
    totalOpps: opportunities.length,
  };
}

// ── metric groups ───────────────────────────────────

interface MetricItem {
  label: string;
  value: string;
  sub?: string; // secondary context line
}

interface MetricGroup {
  title: string;
  icon: React.ElementType;
  color: string;
  metrics: MetricItem[];
}

function buildGroups(role: string | null, d: SummaryData): MetricGroup[] {
  const fmt = formatCurrency;
  const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

  const metasGroup: MetricGroup = {
    title: "Metas",
    icon: Target,
    color: "text-blue-600",
    metrics: [
      { label: "Setup", value: fmt(d.metaSetup) },
      { label: "SaaS", value: fmt(d.metaSaas) },
    ],
  };

  const fechadoGroup: MetricGroup = {
    title: "Fechado",
    icon: CheckCircle2,
    color: "text-emerald-600",
    metrics: [
      { label: "Setup", value: fmt(d.fechadoSetup) },
      { label: "SaaS", value: fmt(d.fechadoSaas) },
    ],
  };

  const pipelineGroup: MetricGroup = {
    title: "Pipeline",
    icon: TrendingUp,
    color: "text-violet-600",
    metrics: [
      { label: "Setup", value: fmt(d.pipelineSetup) },
      { label: "SaaS", value: fmt(d.pipelineSaas) },
    ],
  };

  const saudeGroup: MetricGroup = {
    title: "Saúde",
    icon: AlertTriangle,
    color: d.staleCount > 0 ? "text-amber-600" : "text-emerald-600",
    metrics: [
      { label: "Conversão", value: pct(d.conversao) },
      { label: "Paradas", value: String(d.staleCount), sub: d.staleCount > 0 ? `+${STALE_DAYS}d sem atividade` : "Nenhuma" },
    ],
  };

  if (role === "vendedor") {
    // Seller: personal context, relabel
    metasGroup.title = "Minhas Metas";
    fechadoGroup.title = "Meu Fechado";
    pipelineGroup.title = "Meu Pipeline";
  } else if (role === "gestor") {
    metasGroup.title = "Metas do Time";
    fechadoGroup.title = "Fechado do Time";
    pipelineGroup.title = "Pipeline do Time";
  }

  return [metasGroup, fechadoGroup, pipelineGroup, saudeGroup];
}

function getSummaryLabel(role: string | null): string {
  if (role === "vendedor") return "Meu Resumo";
  if (role === "gestor") return "Resumo do Time";
  return "Resumo Estratégico";
}

// ── collapsed inline items ──────────────────────────

function collapsedItems(d: SummaryData): { label: string; value: string }[] {
  const fmt = formatCurrency;
  return [
    { label: "Meta Setup", value: fmt(d.metaSetup) },
    { label: "Meta SaaS", value: fmt(d.metaSaas) },
    { label: "Fechado Setup", value: fmt(d.fechadoSetup) },
    { label: "Fechado SaaS", value: fmt(d.fechadoSaas) },
    { label: "Conversão", value: `${d.conversao.toFixed(1).replace(".", ",")}%` },
    ...(d.staleCount > 0 ? [{ label: "⚠ Paradas", value: String(d.staleCount) }] : []),
  ];
}

// ── component ───────────────────────────────────────

export function StrategicSummary({ teamFilter }: StrategicSummaryProps) {
  const { profile, role, user } = useAuth();
  const [expanded, setExpanded] = useState(() => role !== "vendedor");
  const [filterUserIds, setFilterUserIds] = useState<string[] | null>(null);
  const [filterResolved, setFilterResolved] = useState(false);

  const monthStr = useMemo(() => getMonthStart(), []);

  useEffect(() => {
    if (role === "vendedor" && user?.id) {
      setFilterUserIds([user.id]);
      setFilterResolved(true);
      return;
    }
    let cancelled = false;
    setFilterResolved(false);
    resolveFilterUserIds(teamFilter).then((ids) => {
      if (!cancelled) { setFilterUserIds(ids); setFilterResolved(true); }
    });
    return () => { cancelled = true; };
  }, [teamFilter, role, user?.id]);

  const { data: values, isLoading } = useQuery({
    queryKey: ["home-strategic-summary", filterUserIds, role, teamFilter, monthStr],
    queryFn: () => fetchSummaryData(filterUserIds, teamFilter, role, user?.id ?? null, monthStr),
    enabled: !!profile?.tenant_id && filterResolved,
    staleTime: 30_000,
  });

  const loading = isLoading || !filterResolved;

  const d = values ?? EMPTY;
  const groups = buildGroups(role, d);
  const summaryLabel = getSummaryLabel(role);
  const collapsed = collapsedItems(d);

  return (
    <div className="border-b border-border/60">
      {/* Toggle row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-6 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !expanded && "-rotate-90")} />
        <span>{summaryLabel}</span>
        {!expanded && !loading && (
          <div className="ml-3 flex items-center gap-4 text-[11px] overflow-x-auto">
            {collapsed.map((c) => (
              <span key={c.label} className="flex items-center gap-1 whitespace-nowrap">
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="font-semibold text-foreground">{c.value}</span>
              </span>
            ))}
          </div>
        )}
        {!expanded && loading && (
          <div className="ml-3 flex items-center gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 w-16 rounded bg-muted animate-pulse" />
            ))}
          </div>
        )}
      </button>

      {/* Expanded grouped metrics */}
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-3.5">
          {loading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card h-[88px] animate-pulse" />
              ))
            : groups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
                    <group.icon className={cn("h-3.5 w-3.5", group.color)} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.title}
                    </span>
                  </div>
                  <div className="px-3.5 pb-3 space-y-1">
                    {group.metrics.map((m) => (
                      <div key={m.label} className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] text-muted-foreground">{m.label}</span>
                        <div className="text-right">
                          <span className="text-[13px] font-semibold tabular-nums">{m.value}</span>
                          {m.sub && (
                            <p className="text-[10px] text-muted-foreground leading-tight">{m.sub}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
