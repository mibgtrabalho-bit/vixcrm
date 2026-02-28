import { useState, useEffect } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "./KanbanColumn";
import { Opportunity } from "./OpportunityCard";
import { PIPELINE_STAGES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

export function KanbanBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [valueDialog, setValueDialog] = useState<{
    open: boolean;
    opportunityId: string;
    value: string;
  }>({ open: false, opportunityId: "", value: "" });
  const [pendingDrop, setPendingDrop] = useState<DropResult | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.tenant_id) fetchOpportunities();
  }, [profile?.tenant_id]);

  const fetchOpportunities = async () => {
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id, title, value, value_implantacao, value_saas, stage, expected_close_date, notes, assigned_to,
        contacts:contact_id(name),
        companies:company_id(name)
      `)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching opportunities:", error);
      setLoading(false);
      return;
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
      expected_close_date: o.expected_close_date,
    }));

    setOpportunities(mapped);
    setLoading(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId;
    const opp = opportunities.find((o) => o.id === draggableId);

    // Rule: "proposta" requires at least one value > 0
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
    const updateData: any = { stage: newStage };
    if (newValue != null) updateData.value = newValue;

    const { error } = await supabase
      .from("opportunities")
      .update(updateData)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      return;
    }

    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, stage: newStage, ...(newValue != null ? { value: newValue } : {}) } : o
      )
    );
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
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
    </>
  );
}
