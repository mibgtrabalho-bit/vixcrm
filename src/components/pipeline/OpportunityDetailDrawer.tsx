import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EditOpportunityDialog } from "./EditOpportunityDialog";
import type { Opportunity } from "./OpportunityCard";

type TimelineEvent = {
  id: string;
  type: "created" | "stage" | "value" | "next_action" | "note" | "deleted";
  createdAt: string;
  title: string;
  description?: string;
};

type DetailedOpportunity = Opportunity & {
  created_by?: string;
};

const STAGE_LABELS = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, stage.label]));
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStageLabel(stage?: string | null) {
  if (!stage) return "—";
  return STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage;
}

function getTimelineIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "created":
      return "✨";
    case "stage":
      return "🔀";
    case "value":
      return "💰";
    case "next_action":
      return "📅";
    case "deleted":
      return "🗑️";
    case "note":
    default:
      return "📝";
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onUpdated: (updated: Opportunity) => void;
  onDeleted?: (id: string) => void;
}

export function OpportunityDetailDrawer({ open, onOpenChange, opportunity, onUpdated, onDeleted }: Props) {
  const [details, setDetails] = useState<DetailedOpportunity | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !opportunity?.id) return;

    let cancelled = false;

    const loadDetails = async () => {
      setLoading(true);

      const dynamicClient = supabase as any;
      const [oppRes, historyRes, notesRes, activityRes] = await Promise.all([
        supabase
          .from("opportunities")
          .select(`
            id, title, value, value_implantacao, value_saas, stage, notes, expected_close_date, assigned_to,
            contact_id, company_id, first_payment_date, created_at, created_by, proxima_acao_tipo, proxima_acao_data,
            contacts:contact_id(name),
            companies:company_id(name)
          `)
          .eq("id", opportunity.id)
          .single(),
        supabase
          .from("opportunity_stage_history")
          .select("id, from_stage, to_stage, changed_at, changed_by")
          .eq("opportunity_id", opportunity.id)
          .order("changed_at", { ascending: false }),
        dynamicClient
          .from("oportunidade_notas")
          .select("id, autor_id, conteudo, criado_em")
          .eq("oportunidade_id", opportunity.id)
          .order("criado_em", { ascending: false }),
        dynamicClient
          .from("opportunity_activity_log")
          .select("id, actor_id, event_type, metadata, created_at")
          .eq("opportunity_id", opportunity.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (oppRes.error || !oppRes.data) {
        toast({ title: "Erro ao carregar detalhes", description: oppRes.error?.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const detailedOpportunity: DetailedOpportunity = {
        id: oppRes.data.id,
        title: oppRes.data.title,
        value: oppRes.data.value,
        value_implantacao: oppRes.data.value_implantacao,
        value_saas: oppRes.data.value_saas,
        stage: oppRes.data.stage,
        notes: oppRes.data.notes,
        expected_close_date: oppRes.data.expected_close_date,
        assigned_to: oppRes.data.assigned_to,
        contact_id: oppRes.data.contact_id,
        company_id: oppRes.data.company_id,
        first_payment_date: oppRes.data.first_payment_date,
        created_at: oppRes.data.created_at,
        created_by: oppRes.data.created_by,
        proxima_acao_tipo: oppRes.data.proxima_acao_tipo,
        proxima_acao_data: oppRes.data.proxima_acao_data,
        contact_name: oppRes.data.contacts?.name ?? opportunity.contact_name,
        company_name: oppRes.data.companies?.name ?? opportunity.company_name,
      };

      const historyRows = historyRes.data || [];
      const noteRows = notesRes.data || [];
      const activityRows = activityRes.data || [];
      const userIds = [
        detailedOpportunity.assigned_to,
        detailedOpportunity.created_by,
        ...historyRows.map((row: any) => row.changed_by),
        ...noteRows.map((row: any) => row.autor_id),
        ...activityRows.map((row: any) => row.actor_id),
      ].filter(Boolean);

      const [profilesRes, teamRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
          : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string }> }),
        detailedOpportunity.assigned_to
          ? supabase
              .from("team_members")
              .select("teams:team_id(name)")
              .eq("user_id", detailedOpportunity.assigned_to)
              .limit(1)
          : Promise.resolve({ data: [] as Array<{ teams?: { name?: string } | null }> }),
      ]);

      if (cancelled) return;

      const profileMap = new Map<string, string>();
      (profilesRes.data || []).forEach((profile) => profileMap.set(profile.user_id, profile.full_name));

      detailedOpportunity.assigned_to_name = detailedOpportunity.assigned_to
        ? profileMap.get(detailedOpportunity.assigned_to) || opportunity.assigned_to_name
        : opportunity.assigned_to_name;
      detailedOpportunity.team_name = (teamRes.data || [])[0]?.teams?.name || opportunity.team_name;

      const builtTimeline: TimelineEvent[] = [
        {
          id: `created-${detailedOpportunity.id}`,
          type: "created",
          createdAt: detailedOpportunity.created_at || new Date().toISOString(),
          title: `Oportunidade criada por ${profileMap.get(detailedOpportunity.created_by || "") || "Usuário"} em ${formatDateTime(detailedOpportunity.created_at)}`,
        },
        ...historyRows.map((row: any) => ({
          id: `stage-${row.id}`,
          type: "stage" as const,
          createdAt: row.changed_at,
          title: `Movido de ${getStageLabel(row.from_stage)} para ${getStageLabel(row.to_stage)} por ${profileMap.get(row.changed_by) || "Usuário"} em ${formatDateTime(row.changed_at)}`,
        })),
        ...activityRows.flatMap((row: any) => {
          if (row.event_type === "value_updated") {
            return [{
              id: `value-${row.id}`,
              type: "value" as const,
              createdAt: row.created_at,
              title: `Valor atualizado por ${profileMap.get(row.actor_id) || "Usuário"} em ${formatDateTime(row.created_at)}`,
              description: `Implantação: ${row.metadata?.new_value_implantacao != null ? currencyFormatter.format(row.metadata.new_value_implantacao) : "—"} • SaaS: ${row.metadata?.new_value_saas != null ? currencyFormatter.format(row.metadata.new_value_saas) : "—"}`,
            }];
          }

          if (row.event_type === "next_action_updated") {
            return [{
              id: `next-action-${row.id}`,
              type: "next_action" as const,
              createdAt: row.created_at,
              title: `Próxima ação atualizada por ${profileMap.get(row.actor_id) || "Usuário"} em ${formatDateTime(row.created_at)}`,
              description: row.metadata?.new_tipo || row.metadata?.new_data
                ? `${row.metadata?.new_tipo || "Ação"}${row.metadata?.new_data ? ` • ${formatDate(row.metadata.new_data)}` : ""}`
                : "Próxima ação removida",
            }];
          }

          if (row.event_type === "opportunity_deleted") {
            return [{
              id: `deleted-${row.id}`,
              type: "deleted" as const,
              createdAt: row.created_at,
              title: `Oportunidade excluída por ${profileMap.get(row.actor_id) || "Usuário"} em ${formatDateTime(row.created_at)}`,
            }];
          }

          return [];
        }),
        ...noteRows.map((row: any) => ({
          id: `note-${row.id}`,
          type: "note" as const,
          createdAt: row.criado_em,
          title: `Nota adicionada por ${profileMap.get(row.autor_id) || "Usuário"} em ${formatDateTime(row.criado_em)}`,
          description: row.conteudo,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setDetails(detailedOpportunity);
      setTimeline(builtTimeline);
      setLoading(false);
    };

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [open, opportunity?.id, refreshNonce]);

  const keyInfo = useMemo(() => {
    if (!details) return [];

    return [
      { label: "Responsável", value: details.assigned_to_name || "—" },
      { label: "Time", value: details.team_name || "—" },
      { label: "Implantação", value: details.value_implantacao != null ? currencyFormatter.format(details.value_implantacao) : "—" },
      { label: "SaaS", value: details.value_saas != null ? currencyFormatter.format(details.value_saas) : "—" },
      { label: "Contato", value: details.contact_name || "—" },
      { label: "Empresa", value: details.company_name || "—" },
      {
        label: "Próxima ação",
        value: details.proxima_acao_data ? `${details.proxima_acao_tipo || "Ação"} • ${formatDate(details.proxima_acao_data)}` : null,
      },
      { label: "Criada em", value: formatDateTime(details.created_at) },
    ].filter((item) => item.value);
  }, [details]);

  const handleNoteSave = async () => {
    if (!opportunity?.id || !user || !noteContent.trim()) return;

    setSavingNote(true);
    const dynamicClient = supabase as any;
    const { error } = await dynamicClient.from("oportunidade_notas").insert({
      oportunidade_id: opportunity.id,
      autor_id: user.id,
      conteudo: noteContent.trim(),
    });

    if (error) {
      toast({ title: "Erro ao salvar nota", description: error.message, variant: "destructive" });
    } else {
      setNoteContent("");
      setRefreshNonce((value) => value + 1);
      toast({ title: "Nota salva" });
    }

    setSavingNote(false);
  };

  const stageLabel = details ? getStageLabel(details.stage) : getStageLabel(opportunity?.stage);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-[480px]">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="space-y-2">
                  <SheetTitle className="text-xl">{details?.title || opportunity?.title || "Oportunidade"}</SheetTitle>
                  <Badge variant="secondary">{stageLabel}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={!opportunity}>
                  Editar
                </Button>
              </div>
              <SheetDescription className="sr-only">Detalhes completos da oportunidade, histórico e notas.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Informações principais</h3>
                    </div>
                    <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
                      {keyInfo.map((item) => (
                        <div key={item.label} className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                          <p className="text-sm text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
                    </div>
                    <div className="space-y-3">
                      {timeline.map((event) => (
                        <div key={event.id} className="rounded-xl border border-border/60 bg-card p-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 text-base" aria-hidden="true">{getTimelineIcon(event.type)}</span>
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm text-foreground">{event.title}</p>
                              {event.description && (
                                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Notas</h3>
                    </div>
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <Textarea
                        placeholder="Adicionar nota..."
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        rows={4}
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleNoteSave} disabled={savingNote || !noteContent.trim()}>
                          {savingNote ? "Salvando..." : "Salvar nota"}
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EditOpportunityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        opportunity={details || opportunity}
        onUpdated={(updated) => {
          onUpdated(updated);
          setDetails((current) => (current ? { ...current, ...updated } : updated));
          setRefreshNonce((value) => value + 1);
        }}
        onDeleted={(id) => {
          onDeleted?.(id);
          setEditOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}