import { useState, useEffect } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "./KanbanColumn";
import { Opportunity } from "./OpportunityCard";
import { EditOpportunityDialog } from "./EditOpportunityDialog";
import { PIPELINE_STAGES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto px-6 py-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-3">
          <Skeleton className="h-5 w-24 rounded-lg mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface KanbanBoardProps {
  teamFilter?: string;
}

export function KanbanBoard({ teamFilter = "all" }: KanbanBoardProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [valueDialog, setValueDialog] = useState<{
    open: boolean;
    opportunityId: string;
    value: string;
  }>({ open: false, opportunityId: "", value: "" });
  const [pendingDrop, setPendingDrop] = useState<DropResult | null>(null);
  const [teamMemberIds, setTeamMemberIds] = useState<string[] | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resolve filter to assigned_to user IDs
  useEffect(() => {
    if (teamFilter === "all") {
      setTeamMemberIds(null);
      return;
    }

    // Individual user filter: "user:<userId>"
    if (teamFilter.startsWith("user:")) {
      const userId = teamFilter.slice(5);
      setTeamMemberIds([userId]);
      return;
    }

    // Team filter: "team:<teamId>" or bare teamId (legacy)
    const teamId = teamFilter.startsWith("team:") ? teamFilter.slice(5) : teamFilter;
    const fetchTeamMembers = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);
      setTeamMemberIds((data || []).map((m) => m.user_id));
    };
    fetchTeamMembers();
  }, [teamFilter]);

  useEffect(() => {
    if (profile?.tenant_id) fetchOpportunities();
  }, [profile?.tenant_id, teamMemberIds]);

  const fetchOpportunities = async () => {
    let query = supabase
      .from("opportunities")
      .select(`
        id, title, value, value_implantacao, value_saas, stage, expected_close_date, notes, assigned_to, contact_id, company_id, first_payment_date, created_at, last_activity_at,
        contacts:contact_id(name),
        companies:company_id(name)
      `)
      .order("created_at", { ascending: true });

    // Server-side team filter
    if (teamMemberIds !== null) {
      if (teamMemberIds.length === 0) {
        setOpportunities([]);
        setLoading(false);
        return;
      }
      query = query.in("assigned_to", teamMemberIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching opportunities:", error);
      setLoading(false);
      return;
    }

    // Collect unique assigned_to IDs to fetch names + teams in bulk
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

    const mapped: Opportunity[] = (data || []).map((o: any) => ({
      id: o.id,
      title: o.title,
      value: o.value,
      value_implantacao: o.value_implantacao,
      value_saas: o.value_saas,
      stage: o.stage,
      company_name: o.companies?.name,
      contact_name: o.contacts?.name,
      assigned_to_name: profileMap.get(o.assigned_to) || null,
      team_name: teamNameMap.get(o.assigned_to) || null,
      expected_close_date: o.expected_close_date,
      notes: o.notes,
      contact_id: o.contact_id,
      company_id: o.company_id,
      assigned_to: o.assigned_to,
      first_payment_date: o.first_payment_date,
      created_at: o.created_at,
      last_activity_at: o.last_activity_at,
    }));

    setOpportunities(mapped);
    setLoading(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId;
    const opp = opportunities.find((o) => o.id === draggableId);

    const hasValue = (opp?.value_implantacao && opp.value_implantacao > 0) || (opp?.value_saas && opp.value_saas > 0) || (opp?.value && opp.value > 0);
    if (newStage === "proposta" && !hasValue) {
      setPendingDrop(result);
      setValueDialog({
        open: true,
        opportunityId: draggableId,
        value: "",
      });
      return;
    }

    await moveOpportunity(draggableId, newStage);
  };

  const moveOpportunity = async (id: string, newStage: string, newValue?: number) => {
    // Optimistic update
    const previousOpps = [...opportunities];
    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, stage: newStage, ...(newValue != null ? { value: newValue } : {}) } : o
      )
    );

    const updateData: any = { stage: newStage };
    if (newValue != null) updateData.value = newValue;

    const { error } = await supabase
      .from("opportunities")
      .update(updateData)
      .eq("id", id);

    if (error) {
      // Rollback on failure
      setOpportunities(previousOpps);
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      return;
    }

    // Invalidate dashboard stats so conversion updates immediately
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const handleValueSubmit = async () => {
    const val = parseFloat(valueDialog.value);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Valor inválido", description: "Informe um valor maior que zero.", variant: "destructive" });
      return;
    }

    await moveOpportunity(valueDialog.opportunityId, "proposta", val);
    setValueDialog({ open: false, opportunityId: "", value: "" });
    setPendingDrop(null);
  };

  const handleCardClick = (opp: Opportunity) => {
    setEditingOpp(opp);
    setEditOpen(true);
  };

  const handleOpportunityUpdated = (updated: Opportunity) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const handleOpportunityDeleted = (id: string) => {
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  if (loading) {
    return <KanbanSkeleton />;
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto px-6 py-4">
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stageId={stage.id}
              label={stage.label}
              color={stage.color.replace("var(--", "").replace(")", "")}
              opportunities={opportunities.filter((o) => o.stage === stage.id)}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      <Dialog open={valueDialog.open} onOpenChange={(open) => {
        if (!open) {
          setValueDialog({ open: false, opportunityId: "", value: "" });
          setPendingDrop(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valor da Proposta</DialogTitle>
            <DialogDescription>
              Para mover para "Proposta", é obrigatório informar o valor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="proposal-value">Valor (R$)</Label>
              <Input
                id="proposal-value"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={valueDialog.value}
                onChange={(e) =>
                  setValueDialog((v) => ({ ...v, value: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setValueDialog({ open: false, opportunityId: "", value: "" });
                  setPendingDrop(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleValueSubmit}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditOpportunityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        opportunity={editingOpp}
        onUpdated={handleOpportunityUpdated}
        onDeleted={handleOpportunityDeleted}
      />
    </>
  );
}
