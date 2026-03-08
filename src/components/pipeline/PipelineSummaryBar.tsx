import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parsePipelineFilter } from "./PipelineTeamFilter";
import { Target, TrendingUp } from "lucide-react";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

interface PipelineSummaryBarProps {
  teamFilter: string;
  refreshKey: number;
}

export function PipelineSummaryBar({ teamFilter, refreshKey }: PipelineSummaryBarProps) {
  const { role, user, profile } = useAuth();
  const [targetSaas, setTargetSaas] = useState(0);
  const [targetSetup, setTargetSetup] = useState(0);
  const [pipelineSaas, setPipelineSaas] = useState(0);
  const [pipelineSetup, setPipelineSetup] = useState(0);
  const [loading, setLoading] = useState(true);

  const monthStr = useMemo(() => getMonthStart(), []);
  const filter = useMemo(() => parsePipelineFilter(teamFilter), [teamFilter]);

  useEffect(() => {
    if (profile?.tenant_id && user?.id && role) fetchSummary();
  }, [profile?.tenant_id, user?.id, role, teamFilter, refreshKey, monthStr]);

  const fetchSummary = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // 1. Determine which user IDs are in scope for pipeline values
      let scopeUserIds: string[] | null = null; // null = all visible

      if (role === "vendedor") {
        scopeUserIds = [user.id];
      } else if (filter.type === "user" && filter.id) {
        scopeUserIds = [filter.id];
      } else if (filter.type === "team" && filter.id) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", filter.id);
        scopeUserIds = (members || []).map((m) => m.user_id);
      }
      // filter.type === "all" → scopeUserIds stays null (use all visible)

      // 2. Fetch targets based on scope
      let tSaas = 0;
      let tSetup = 0;

      if (role === "vendedor") {
        // Seller: own monthly_target
        const { data } = await supabase
          .from("monthly_targets")
          .select("target_saas, target_setup")
          .eq("user_id", user.id)
          .eq("month", monthStr)
          .maybeSingle();
        tSaas = data?.target_saas ?? 0;
        tSetup = data?.target_setup ?? 0;
      } else if (filter.type === "user" && filter.id) {
        // Viewing a specific seller
        const { data } = await supabase
          .from("monthly_targets")
          .select("target_saas, target_setup")
          .eq("user_id", filter.id)
          .eq("month", monthStr)
          .maybeSingle();
        tSaas = data?.target_saas ?? 0;
        tSetup = data?.target_setup ?? 0;
      } else if (filter.type === "team" && filter.id) {
        // Viewing a team → use team_target
        const { data } = await supabase
          .from("team_targets" as any)
          .select("target_saas, target_setup")
          .eq("team_id", filter.id)
          .eq("month", monthStr)
          .maybeSingle();
        tSaas = (data as any)?.target_saas ?? 0;
        tSetup = (data as any)?.target_setup ?? 0;
      } else if (filter.type === "all") {
        // Director viewing all → sum all team targets
        const { data } = await supabase
          .from("team_targets" as any)
          .select("target_saas, target_setup")
          .eq("month", monthStr);
        (data || []).forEach((t: any) => {
          tSaas += Number(t.target_saas) || 0;
          tSetup += Number(t.target_setup) || 0;
        });
      }

      setTargetSaas(tSaas);
      setTargetSetup(tSetup);

      // 3. Fetch pipeline opportunity values (all stages except perdido)
      let oppQuery = supabase
        .from("opportunities")
        .select("value_saas, value_implantacao, assigned_to")
        .neq("stage", "perdido");

      if (scopeUserIds !== null && scopeUserIds.length > 0) {
        oppQuery = oppQuery.in("assigned_to", scopeUserIds);
      } else if (scopeUserIds !== null && scopeUserIds.length === 0) {
        setPipelineSaas(0);
        setPipelineSetup(0);
        setLoading(false);
        return;
      }

      const { data: opps } = await oppQuery;

      let pSaas = 0;
      let pSetup = 0;
      (opps || []).forEach((o: any) => {
        pSaas += Number(o.value_saas) || 0;
        pSetup += Number(o.value_implantacao) || 0;
      });

      setPipelineSaas(pSaas);
      setPipelineSetup(pSetup);
    } catch (err) {
      console.error("Error fetching pipeline summary:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[72px] rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Meta SaaS",
      value: formatCurrency(targetSaas),
      icon: Target,
      accent: "text-blue-600",
    },
    {
      label: "Meta Setup",
      value: formatCurrency(targetSetup),
      icon: Target,
      accent: "text-violet-600",
    },
    {
      label: "Pipeline SaaS",
      value: formatCurrency(pipelineSaas),
      icon: TrendingUp,
      accent: "text-emerald-600",
    },
    {
      label: "Pipeline Setup",
      value: formatCurrency(pipelineSetup),
      icon: TrendingUp,
      accent: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pt-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-lg bg-muted p-2 ${card.accent}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{card.label}</p>
              <p className="text-sm font-semibold truncate">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
