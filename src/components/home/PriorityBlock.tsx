import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/metrics";
import { PIPELINE_STAGES } from "@/lib/constants";
import { Clock, AlertTriangle, FileWarning, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityBlockProps {
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

interface PriorityData {
  idle3: number;   // 3-4 days without activity
  idle5: number;   // 5+ days without activity
  stalledProposals: number; // proposta/negociacao with 5+ days idle
  stalledValue: number;     // total value of stalled proposals
}

const EMPTY: PriorityData = { idle3: 0, idle5: 0, stalledProposals: 0, stalledValue: 0 };

async function fetchPriorities(filterUserIds: string[] | null): Promise<PriorityData> {
  if (filterUserIds !== null && filterUserIds.length === 0) return EMPTY;

  let query = supabase
    .from("opportunities")
    .select("id, stage, last_activity_at, value_implantacao, value_saas")
    .not("stage", "in", '("fechado","perdido")');

  if (filterUserIds !== null) {
    query = query.in("assigned_to", filterUserIds);
  }

  const { data: opps } = await query;
  const now = Date.now();
  const DAY = 86400000;

  let idle3 = 0;
  let idle5 = 0;
  let stalledProposals = 0;
  let stalledValue = 0;

  for (const o of opps || []) {
    const lastAct = o.last_activity_at ? new Date(o.last_activity_at).getTime() : 0;
    const daysIdle = (now - lastAct) / DAY;

    if (daysIdle >= 5) {
      idle5++;
      if (o.stage === "proposta" || o.stage === "negociacao") {
        stalledProposals++;
        stalledValue += (Number(o.value_implantacao) || 0) + (Number(o.value_saas) || 0);
      }
    } else if (daysIdle >= 3) {
      idle3++;
    }
  }

  return { idle3, idle5, stalledProposals, stalledValue };
}

const stageLabel = (id: string) => PIPELINE_STAGES.find((s) => s.id === id)?.label || id;

export function PriorityBlock({ teamFilter }: PriorityBlockProps) {
  const { profile, role, user } = useAuth();
  const [filterUserIds, setFilterUserIds] = useState<string[] | null>(null);
  const [filterResolved, setFilterResolved] = useState(false);

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

  const { data } = useQuery({
    queryKey: ["home-priorities", filterUserIds],
    queryFn: () => fetchPriorities(filterUserIds),
    enabled: !!profile?.tenant_id && filterResolved,
    staleTime: 30_000,
    initialData: EMPTY,
  });

  const hasAnything = data.idle3 > 0 || data.idle5 > 0;

  if (!hasAnything) return null;

  const items: { icon: React.ElementType; color: string; bg: string; label: string; count: string; sub?: string }[] = [];

  if (data.idle5 > 0) {
    items.push({
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
      label: "Sem atividade há 5+ dias",
      count: String(data.idle5),
      sub: "Risco de perda",
    });
  }

  if (data.stalledProposals > 0) {
    items.push({
      icon: FileWarning,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      label: "Propostas paradas",
      count: `${data.stalledProposals} · ${formatCurrency(data.stalledValue)}`,
      sub: "Proposta/Negociação sem movimento",
    });
  }

  if (data.idle3 > 0) {
    items.push({
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      label: "Sem atividade há 3+ dias",
      count: String(data.idle3),
      sub: "Atenção necessária",
    });
  }

  return (
    <div className="flex items-stretch gap-2.5 px-6 py-2.5 border-b border-border/60 overflow-x-auto">
      <div className="flex items-center gap-1.5 pr-3 border-r border-border/60">
        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Atenção
        </span>
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-1.5 min-w-0",
            item.bg,
          )}
        >
          <item.icon className={cn("h-3.5 w-3.5 shrink-0", item.color)} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-[13px] font-semibold tabular-nums", item.color)}>{item.count}</span>
              <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
            </div>
            {item.sub && (
              <p className="text-[10px] text-muted-foreground/70 leading-tight">{item.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
