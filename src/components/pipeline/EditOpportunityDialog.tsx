import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PIPELINE_STAGES } from "@/lib/constants";
import type { Opportunity } from "./OpportunityCard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onUpdated: (updated: Opportunity) => void;
}

export function EditOpportunityDialog({ open, onOpenChange, opportunity, onUpdated }: Props) {
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState("");
  const [valueImplantacao, setValueImplantacao] = useState("");
  const [valueSaas, setValueSaas] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>();

  const { user, profile, role } = useAuth();
  const { toast } = useToast();

  const canChangeOwner = role === "gestor" || role === "diretor";

  useEffect(() => {
    if (open && opportunity) {
      setTitle(opportunity.title);
      setStage(opportunity.stage);
      setValueImplantacao(opportunity.value_implantacao?.toString() || "");
      setValueSaas(opportunity.value_saas?.toString() || "");
      setNotes(opportunity.notes || "");
      setContactId(opportunity.contact_id || "");
      setCompanyId(opportunity.company_id || "");
      setAssignedTo(opportunity.assigned_to || "");
      setExpectedCloseDate(opportunity.expected_close_date ? new Date(opportunity.expected_close_date) : undefined);
      setFirstPaymentDate(opportunity.first_payment_date ? new Date(opportunity.first_payment_date) : undefined);

      // Fetch lookups
      supabase.from("contacts").select("id, name").then(({ data }) => setContacts(data || []));
      supabase.from("companies").select("id, name").then(({ data }) => setCompanies(data || []));
      if (canChangeOwner) {
        supabase.from("profiles").select("user_id, full_name").then(({ data }) => setTeamMembers(data || []));
      }
    }
  }, [open, opportunity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity || !user) return;
    setLoading(true);

    const numImpl = valueImplantacao ? parseFloat(valueImplantacao) : null;
    const numSaas = valueSaas ? parseFloat(valueSaas) : null;

    if (stage === "proposta" && !numImpl && !numSaas && !(opportunity.value && opportunity.value > 0)) {
      toast({ title: "Valor obrigatório", description: "Para 'Proposta', informe ao menos um valor.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const updateData: Record<string, any> = {
      title,
      stage: stage as any,
      value_implantacao: numImpl,
      value_saas: numSaas,
      notes: notes || null,
      contact_id: contactId || null,
      company_id: companyId || null,
      expected_close_date: expectedCloseDate ? format(expectedCloseDate, "yyyy-MM-dd") : null,
      first_payment_date: firstPaymentDate ? format(firstPaymentDate, "yyyy-MM-dd") : null,
    };

    if (canChangeOwner && assignedTo) {
      updateData.assigned_to = assignedTo;
    }

    // Optimistic update
    const optimistic: Opportunity = {
      ...opportunity,
      title,
      stage,
      value_implantacao: numImpl,
      value_saas: numSaas,
      expected_close_date: expectedCloseDate ? format(expectedCloseDate, "yyyy-MM-dd") : undefined,
    };
    onUpdated(optimistic);
    onOpenChange(false);

    const { error } = await supabase
      .from("opportunities")
      .update(updateData)
      .eq("id", opportunity.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      // Revert optimistic
      onUpdated(opportunity);
    } else {
      toast({ title: "Oportunidade atualizada!" });
    }
    setLoading(false);
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Oportunidade</DialogTitle>
          <DialogDescription>Atualize os dados da oportunidade.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-title">Título *</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div>
            <Label>Etapa</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canChangeOwner && (
            <div>
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-impl">Valor Implantação (R$)</Label>
              <Input id="edit-impl" type="number" step="0.01" value={valueImplantacao} onChange={(e) => setValueImplantacao(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label htmlFor="edit-saas">Valor SaaS (R$)</Label>
              <Input id="edit-saas" type="number" step="0.01" value={valueSaas} onChange={(e) => setValueSaas(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {valueSaas && (
            <div>
              <Label>Data Primeira Mensalidade</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !firstPaymentDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {firstPaymentDate ? format(firstPaymentDate, "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={firstPaymentDate} onSelect={setFirstPaymentDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div>
            <Label>Previsão de Fechamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedCloseDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedCloseDate ? format(expectedCloseDate, "dd/MM/yyyy") : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={expectedCloseDate} onSelect={setExpectedCloseDate} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Contato</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-notes">Observações</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
