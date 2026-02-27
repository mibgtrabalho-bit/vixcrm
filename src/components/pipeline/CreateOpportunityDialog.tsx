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
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PIPELINE_STAGES } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateOpportunityDialog({ open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState("prospeccao");
  const [valueImplantacao, setValueImplantacao] = useState("");
  const [valueSaas, setValueSaas] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Inline new contact
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && profile?.tenant_id) {
      supabase.from("contacts").select("id, name").then(({ data }) => setContacts(data || []));
      supabase.from("companies").select("id, name").then(({ data }) => setCompanies(data || []));
    }
  }, [open, profile?.tenant_id]);

  const resetForm = () => {
    setTitle("");
    setStage("prospeccao");
    setValueImplantacao("");
    setValueSaas("");
    setFirstPaymentDate(undefined);
    setNotes("");
    setContactId("");
    setCompanyId("");
    setShowNewContact(false);
    setNewContactName("");
    setNewContactEmail("");
    setNewContactPhone("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setLoading(true);

    let finalContactId = contactId;

    // Create inline contact if needed
    if (showNewContact) {
      if (!newContactName.trim()) {
        toast({ title: "Nome do contato é obrigatório", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          name: newContactName.trim(),
          email: newContactEmail || null,
          phone: newContactPhone || null,
          tenant_id: profile.tenant_id,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (contactError) {
        toast({ title: "Erro ao criar contato", description: contactError.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      finalContactId = newContact.id;
    }

    if (!finalContactId) {
      toast({ title: "Contato obrigatório", description: "Selecione ou crie um contato.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const numImplantacao = valueImplantacao ? parseFloat(valueImplantacao) : null;
    const numSaas = valueSaas ? parseFloat(valueSaas) : null;

    if (stage === "proposta" && !numImplantacao && !numSaas) {
      toast({ title: "Valor obrigatório", description: "Para 'Proposta', informe ao menos um valor.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("opportunities").insert({
      title,
      stage: stage as any,
      value_implantacao: numImplantacao,
      value_saas: numSaas,
      first_payment_date: firstPaymentDate ? format(firstPaymentDate, "yyyy-MM-dd") : null,
      notes: notes || null,
      contact_id: finalContactId,
      company_id: companyId || null,
      tenant_id: profile.tenant_id,
      assigned_to: user.id,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Oportunidade criada!" });
      onCreated();
      onOpenChange(false);
      resetForm();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Oportunidade</DialogTitle>
          <DialogDescription>Adicione uma nova oportunidade ao pipeline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <Label htmlFor="opp-title">Título *</Label>
            <Input id="opp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Proposta Empresa X" required />
          </div>

          {/* Etapa */}
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

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="opp-impl">Valor Implantação (R$)</Label>
              <Input id="opp-impl" type="number" step="0.01" value={valueImplantacao} onChange={(e) => setValueImplantacao(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label htmlFor="opp-saas">Valor SaaS (R$)</Label>
              <Input id="opp-saas" type="number" step="0.01" value={valueSaas} onChange={(e) => setValueSaas(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {/* Data primeira mensalidade */}
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

          {/* Contato */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Contato *</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowNewContact(!showNewContact)}>
                <Plus className="h-3 w-3 mr-1" />
                {showNewContact ? "Selecionar existente" : "Novo contato"}
              </Button>
            </div>
            {showNewContact ? (
              <div className="space-y-2 rounded-md border p-3">
                <Input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Nome *" />
                <Input value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} placeholder="Email" type="email" />
                <Input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="Telefone" />
              </div>
            ) : (
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Empresa (opcional) */}
          <div>
            <Label>Empresa (opcional)</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="opp-notes">Observações</Label>
            <Textarea id="opp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Criando..." : "Criar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
