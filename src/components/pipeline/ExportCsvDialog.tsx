import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Users, User } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/constants";

interface TeamWithMembers {
  id: string;
  name: string;
  members: { user_id: string; full_name: string }[];
}

interface ExportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilter?: string;
}

const STAGE_LABEL_MAP = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.id, s.label])
);

const fmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return dateStr;
  }
}

export function ExportCsvDialog({ open, onOpenChange, currentFilter }: ExportCsvDialogProps) {
  const { role, user } = useAuth();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open && role !== "vendedor") {
      loadTeams();
    }
  }, [open, role]);

  const loadTeams = async () => {
    if (!user?.id) return;
    setLoading(true);

    let teamIds: string[] = [];
    let teamsList: { id: string; name: string }[] = [];

    if (role === "diretor") {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      teamsList = data || [];
      teamIds = teamsList.map((t) => t.id);
    } else if (role === "gestor") {
      const { data: myTeams } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("user_id", user.id);
      teamsList = (myTeams || []).map((t: any) => t.teams).filter(Boolean);
      teamIds = teamsList.map((t) => t.id);
    }

    if (teamIds.length > 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      const memberUserIds = [...new Set((members || []).map((m: any) => m.user_id))];
      const { data: profiles } = memberUserIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", memberUserIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      const result: TeamWithMembers[] = teamsList.map((t) => ({
        id: t.id,
        name: t.name,
        members: (members || [])
          .filter((m: any) => m.team_id === t.id && profileMap.has(m.user_id))
          .map((m: any) => ({ user_id: m.user_id, full_name: profileMap.get(m.user_id) || "Sem nome" }))
          .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)),
      }));

      setTeams(result);
    }

    setLoading(false);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleExport = async (useCurrentFilter: boolean) => {
    setExporting(true);

    try {
      // Build the list of user IDs to filter by
      let filterUserIds: string[] | null = null;

      if (role === "vendedor") {
        filterUserIds = user?.id ? [user.id] : [];
      } else if (useCurrentFilter && currentFilter && currentFilter !== "all") {
        // Use the current pipeline filter
        if (currentFilter.startsWith("user:")) {
          filterUserIds = [currentFilter.slice(5)];
        } else {
          const teamId = currentFilter.startsWith("team:") ? currentFilter.slice(5) : currentFilter;
          const { data } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
          filterUserIds = (data || []).map((m) => m.user_id);
        }
      } else if (!useCurrentFilter && (selectedTeamIds.size > 0 || selectedUserIds.size > 0)) {
        const ids = new Set<string>(selectedUserIds);
        // Add users from selected teams
        for (const teamId of selectedTeamIds) {
          const team = teams.find((t) => t.id === teamId);
          if (team) team.members.forEach((m) => ids.add(m.user_id));
        }
        filterUserIds = [...ids];
      }

      // Query opportunities
      let query = supabase
        .from("opportunities")
        .select(`
          id, title, value, value_implantacao, value_saas, stage,
          expected_close_date, first_payment_date, notes, assigned_to,
          contact_id, company_id, created_at, updated_at,
          contacts:contact_id(name),
          companies:company_id(name)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filterUserIds !== null && filterUserIds.length > 0) {
        query = query.in("assigned_to", filterUserIds);
      } else if (filterUserIds !== null && filterUserIds.length === 0) {
        // No users selected = nothing to export
        setExporting(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profile names and team names for assigned_to
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
          if (!teamNameMap.has(tm.user_id) && tm.teams?.name) {
            teamNameMap.set(tm.user_id, tm.teams.name);
          }
        });
      }

      // Build CSV
      const headers = [
        "Oportunidade", "Etapa", "Responsável", "Time", "Contato", "Empresa",
        "Valor SaaS Mensal", "Valor Implantação", "Valor Total",
        "Fechamento Previsto", "Primeira Mensalidade", "Criado em", "Atualizado em", "Observações"
      ];

      const escCsv = (val: string) => {
        if (val.includes(";") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const rows = (data || []).map((o: any) => [
        escCsv(o.title || ""),
        escCsv(STAGE_LABEL_MAP[o.stage] || o.stage || ""),
        escCsv(profileMap.get(o.assigned_to) || ""),
        escCsv(teamNameMap.get(o.assigned_to) || ""),
        escCsv(o.contacts?.name || ""),
        escCsv(o.companies?.name || ""),
        o.value_saas != null ? fmt.format(o.value_saas) : "",
        o.value_implantacao != null ? fmt.format(o.value_implantacao) : "",
        o.value != null ? fmt.format(o.value) : "",
        formatDate(o.expected_close_date),
        formatDate(o.first_payment_date),
        formatDateTime(o.created_at),
        formatDateTime(o.updated_at),
        escCsv((o.notes || "").replace(/\n/g, " ")),
      ].join(";"));

      const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `oportunidades-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (err: any) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Seller: direct export, no dialog needed
  if (role === "vendedor") {
    if (open) {
      handleExport(false);
      onOpenChange(false);
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Oportunidades</DialogTitle>
          <DialogDescription>
            Escolha o escopo de exportação ou selecione times e usuários específicos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => handleExport(true)}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              Exportar filtro atual
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                setSelectedTeamIds(new Set());
                setSelectedUserIds(new Set());
                handleExport(false);
              }}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              Exportar todas (meu escopo)
            </Button>
          </div>

          {/* Team/user selection */}
          {!loading && teams.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Ou selecione times/usuários:</p>
              <div className="max-h-[240px] overflow-y-auto space-y-1 rounded-lg border border-border/60 p-2">
                {teams.map((team) => (
                  <div key={team.id}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent cursor-pointer">
                      <Checkbox
                        checked={selectedTeamIds.has(team.id)}
                        onCheckedChange={() => toggleTeam(team.id)}
                      />
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {team.name}
                    </label>
                    {team.members.map((member) => (
                      <label
                        key={member.user_id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 pl-8 text-sm hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedUserIds.has(member.user_id)}
                          onCheckedChange={() => toggleUser(member.user_id)}
                        />
                        <User className="h-3 w-3 text-muted-foreground" />
                        {member.full_name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <Button
                onClick={() => handleExport(false)}
                disabled={exporting || (selectedTeamIds.size === 0 && selectedUserIds.size === 0)}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar seleção
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
