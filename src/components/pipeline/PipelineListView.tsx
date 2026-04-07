import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Opportunity } from "./OpportunityCard";
import { OpportunityDetailDrawer } from "./OpportunityDetailDrawer";
import { PIPELINE_STAGES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InboxIcon } from "lucide-react";

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, s.label]));
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

interface PipelineListViewProps {
  teamFilter?: string;
}

export function PipelineListView({ teamFilter = "all" }: PipelineListViewProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teamMemberIds, setTeamMemberIds] = useState<string[] | null>(null);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (teamFilter === "all") { setTeamMemberIds(null); return; }
    if (teamFilter.startsWith("user:")) { setTeamMemberIds([teamFilter.slice(5)]); return; }
    const teamId = teamFilter.startsWith("team:") ? teamFilter.slice(5) : teamFilter;
    (async () => {
      const { data } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
      setTeamMemberIds((data || []).map((m) => m.user_id));
    })();
  }, [teamFilter]);

  useEffect(() => {
    if (profile?.tenant_id) fetchOpportunities();
  }, [profile?.tenant_id, teamMemberIds]);

  const fetchOpportunities = async () => {
    let query = supabase
      .from("opportunities")
      .select(`
        id, title, value, value_implantacao, value_saas, stage, expected_close_date, notes, assigned_to, contact_id, company_id, first_payment_date, updated_at,
        contacts:contact_id(name),
        companies:company_id(name)
      `)
      .order("updated_at", { ascending: false });

    if (teamMemberIds !== null) {
      if (teamMemberIds.length === 0) { setOpportunities([]); setLoading(false); return; }
      query = query.in("assigned_to", teamMemberIds);
    }

    const { data, error } = await query;
    if (error) { console.error(error); setLoading(false); return; }

    const assignedIds = [...new Set((data || []).map((o: any) => o.assigned_to).filter(Boolean))];
    let profileMap = new Map<string, string>();
    let teamNameMap = new Map<string, string>();

    if (assignedIds.length > 0) {
      const [{ data: profiles }, { data: tmData }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", assignedIds),
        supabase.from("team_members").select("user_id, teams:team_id(name)").in("user_id", assignedIds),
      ]);
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p.full_name));
      (tmData || []).forEach((tm: any) => {
        if (!teamNameMap.has(tm.user_id) && tm.teams?.name) teamNameMap.set(tm.user_id, tm.teams.name);
      });
    }

    setOpportunities((data || []).map((o: any) => ({
      id: o.id, title: o.title, value: o.value, value_implantacao: o.value_implantacao,
      value_saas: o.value_saas, stage: o.stage, company_name: o.companies?.name,
      contact_name: o.contacts?.name, assigned_to_name: profileMap.get(o.assigned_to) || null,
      team_name: teamNameMap.get(o.assigned_to) || null, expected_close_date: o.expected_close_date,
      notes: o.notes, contact_id: o.contact_id, company_id: o.company_id,
      assigned_to: o.assigned_to, first_payment_date: o.first_payment_date,
      updated_at: o.updated_at,
    })));
    setLoading(false);
  };

  const handleRowClick = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setDetailOpen(true);
  };

  const handleUpdated = (updated: Opportunity) => {
    setOpportunities((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelectedOpp((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const handleDeleted = (id: string) => {
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    setSelectedOpp((prev) => (prev?.id === id ? null : prev));
    setDetailOpen(false);
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  if (loading) {
    return (
      <div className="px-6 py-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <InboxIcon className="h-10 w-10 mb-2" />
        <p className="text-sm">Nenhuma oportunidade encontrada</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto px-6 py-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oportunidade</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">SaaS Mensal</TableHead>
              <TableHead className="text-right">Implantação</TableHead>
              <TableHead>Fechamento</TableHead>
              <TableHead>Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((opp) => (
              <TableRow
                key={opp.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => handleRowClick(opp)}
              >
                <TableCell className="font-medium max-w-[200px] truncate">{opp.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {STAGE_MAP[opp.stage] || opp.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{opp.assigned_to_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{opp.team_name || "—"}</TableCell>
                <TableCell className="text-sm">{opp.contact_name || "—"}</TableCell>
                <TableCell className="text-sm">{opp.company_name || "—"}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {opp.value_saas ? fmt.format(opp.value_saas) : "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {opp.value_implantacao ? fmt.format(opp.value_implantacao) : "—"}
                </TableCell>
                <TableCell className="text-sm">{fmtDate(opp.expected_close_date)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate((opp as any).updated_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OpportunityDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        opportunity={selectedOpp}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </>
  );
}
