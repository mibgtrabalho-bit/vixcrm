import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Star,
  GripVertical,
  Trophy,
  XCircle,
  Archive,
  ChevronRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ────── Types ────── */
interface FunnelStage {
  id: string;
  funnel_id: string;
  name: string;
  key: string;
  display_order: number;
  is_active: boolean;
  is_won_stage: boolean;
  is_lost_stage: boolean;
  opportunity_count?: number;
}

interface Funnel {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  stages: FunnelStage[];
}

/* ────── Helpers ────── */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/* ────── Component ────── */
export function FunnelManagement() {
  const { role, profile } = useAuth();
  const { toast } = useToast();
  const isDirector = role === "diretor";

  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Funnel dialog
  const [funnelDialogOpen, setFunnelDialogOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [funnelName, setFunnelName] = useState("");

  // Stage dialog
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);
  const [stageName, setStageName] = useState("");

  // Deactivate stage confirm
  const [deactivateStage, setDeactivateStage] = useState<FunnelStage | null>(null);

  const [saving, setSaving] = useState(false);

  /* ── Fetch ── */
  const fetchFunnels = useCallback(async () => {
    if (!profile?.tenant_id) return;

    const [{ data: funnelsData }, { data: stagesData }] = await Promise.all([
      supabase
        .from("funnels")
        .select("id, name, is_default, is_active, display_order")
        .order("display_order"),
      supabase
        .from("funnel_stages")
        .select("id, funnel_id, name, key, display_order, is_active, is_won_stage, is_lost_stage")
        .order("display_order"),
    ]);

    // Count opportunities per stage
    const { data: oppCounts } = await supabase
      .from("opportunities")
      .select("funnel_stage_id")
      .is("deleted_at", null);

    const countMap = new Map<string, number>();
    (oppCounts || []).forEach((o: any) => {
      if (o.funnel_stage_id) {
        countMap.set(o.funnel_stage_id, (countMap.get(o.funnel_stage_id) || 0) + 1);
      }
    });

    const stagesByFunnel = new Map<string, FunnelStage[]>();
    (stagesData || []).forEach((s: any) => {
      const stage: FunnelStage = {
        ...s,
        opportunity_count: countMap.get(s.id) || 0,
      };
      const arr = stagesByFunnel.get(s.funnel_id) || [];
      arr.push(stage);
      stagesByFunnel.set(s.funnel_id, arr);
    });

    const result: Funnel[] = (funnelsData || []).map((f: any) => ({
      ...f,
      stages: stagesByFunnel.get(f.id) || [],
    }));

    setFunnels(result);
    setLoading(false);

    // Auto-select first if nothing selected
    if (!selectedId && result.length > 0) {
      setSelectedId(result[0].id);
    }
  }, [profile?.tenant_id, selectedId]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  if (!isDirector) return null;

  const selectedFunnel = funnels.find((f) => f.id === selectedId) || null;

  /* ── Funnel CRUD ── */
  const openCreateFunnel = () => {
    setEditingFunnel(null);
    setFunnelName("");
    setFunnelDialogOpen(true);
  };

  const openEditFunnel = (funnel: Funnel) => {
    setEditingFunnel(funnel);
    setFunnelName(funnel.name);
    setFunnelDialogOpen(true);
  };

  const handleSaveFunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !funnelName.trim()) return;
    setSaving(true);

    if (editingFunnel) {
      const { error } = await supabase
        .from("funnels")
        .update({ name: funnelName.trim() })
        .eq("id", editingFunnel.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Funil renomeado" });
        setFunnelDialogOpen(false);
        fetchFunnels();
      }
    } else {
      const maxOrder = Math.max(0, ...funnels.map((f) => f.display_order));
      const { data, error } = await supabase
        .from("funnels")
        .insert({
          name: funnelName.trim(),
          tenant_id: profile.tenant_id,
          display_order: maxOrder + 1,
          is_default: funnels.length === 0,
        })
        .select("id")
        .single();
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Funil criado" });
        setFunnelDialogOpen(false);
        if (data) setSelectedId(data.id);
        fetchFunnels();
      }
    }
    setSaving(false);
  };

  const handleSetDefault = async (funnel: Funnel) => {
    if (funnel.is_default) return;
    setSaving(true);
    // Unset all defaults for this tenant first
    await supabase
      .from("funnels")
      .update({ is_default: false })
      .eq("tenant_id", profile!.tenant_id);
    const { error } = await supabase
      .from("funnels")
      .update({ is_default: true })
      .eq("id", funnel.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `"${funnel.name}" definido como padrão` });
      fetchFunnels();
    }
    setSaving(false);
  };

  const handleToggleFunnelActive = async (funnel: Funnel) => {
    if (funnel.is_default && funnel.is_active) {
      toast({ title: "O funil padrão não pode ser desativado", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("funnels")
      .update({ is_active: !funnel.is_active })
      .eq("id", funnel.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: funnel.is_active ? "Funil desativado" : "Funil ativado" });
      fetchFunnels();
    }
    setSaving(false);
  };

  /* ── Stage CRUD ── */
  const openCreateStage = () => {
    setEditingStage(null);
    setStageName("");
    setStageDialogOpen(true);
  };

  const openEditStage = (stage: FunnelStage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageDialogOpen(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunnel || !profile?.tenant_id || !stageName.trim()) return;
    setSaving(true);

    if (editingStage) {
      const { error } = await supabase
        .from("funnel_stages")
        .update({ name: stageName.trim() })
        .eq("id", editingStage.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Etapa renomeada" });
        setStageDialogOpen(false);
        fetchFunnels();
      }
    } else {
      const key = slugify(stageName.trim());
      if (!key) {
        toast({ title: "Nome inválido", variant: "destructive" });
        setSaving(false);
        return;
      }
      const maxOrder = Math.max(0, ...selectedFunnel.stages.map((s) => s.display_order));
      const { error } = await supabase.from("funnel_stages").insert({
        funnel_id: selectedFunnel.id,
        tenant_id: profile.tenant_id,
        name: stageName.trim(),
        key,
        display_order: maxOrder + 1,
      });
      if (error) {
        if (error.message.includes("unique") || error.message.includes("duplicate")) {
          toast({ title: "Já existe uma etapa com essa chave neste funil", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Etapa criada" });
        setStageDialogOpen(false);
        fetchFunnels();
      }
    }
    setSaving(false);
  };

  const handleToggleWon = async (stage: FunnelStage) => {
    if (!selectedFunnel) return;
    setSaving(true);
    if (!stage.is_won_stage) {
      // Clear existing won stage in this funnel
      const currentWon = selectedFunnel.stages.find((s) => s.is_won_stage);
      if (currentWon) {
        await supabase.from("funnel_stages").update({ is_won_stage: false }).eq("id", currentWon.id);
      }
    }
    const { error } = await supabase
      .from("funnel_stages")
      .update({ is_won_stage: !stage.is_won_stage })
      .eq("id", stage.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchFunnels();
    }
    setSaving(false);
  };

  const handleToggleLost = async (stage: FunnelStage) => {
    if (!selectedFunnel) return;
    setSaving(true);
    if (!stage.is_lost_stage) {
      const currentLost = selectedFunnel.stages.find((s) => s.is_lost_stage);
      if (currentLost) {
        await supabase.from("funnel_stages").update({ is_lost_stage: false }).eq("id", currentLost.id);
      }
    }
    const { error } = await supabase
      .from("funnel_stages")
      .update({ is_lost_stage: !stage.is_lost_stage })
      .eq("id", stage.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchFunnels();
    }
    setSaving(false);
  };

  const handleDeactivateStage = async () => {
    if (!deactivateStage) return;
    setSaving(true);
    const { error } = await supabase
      .from("funnel_stages")
      .update({ is_active: !deactivateStage.is_active })
      .eq("id", deactivateStage.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: deactivateStage.is_active ? "Etapa desativada" : "Etapa reativada" });
      fetchFunnels();
    }
    setDeactivateStage(null);
    setSaving(false);
  };

  const confirmDeactivateStage = (stage: FunnelStage) => {
    if (stage.is_active && (stage.opportunity_count || 0) > 0) {
      setDeactivateStage(stage);
    } else {
      // Directly toggle if reactivating or no opps
      setDeactivateStage(stage);
      // Will be handled in dialog or directly
    }
  };

  const handleMoveStage = async (stage: FunnelStage, direction: "up" | "down") => {
    if (!selectedFunnel) return;
    const stages = [...selectedFunnel.stages].sort((a, b) => a.display_order - b.display_order);
    const idx = stages.findIndex((s) => s.id === stage.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stages.length) return;

    setSaving(true);
    const a = stages[idx];
    const b = stages[swapIdx];
    await Promise.all([
      supabase.from("funnel_stages").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("funnel_stages").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    fetchFunnels();
    setSaving(false);
  };

  /* ── Render ── */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  const sortedStages = selectedFunnel
    ? [...selectedFunnel.stages].sort((a, b) => a.display_order - b.display_order)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Funis de Vendas</h3>
          <p className="text-sm text-muted-foreground">Gerencie seus funis e etapas de vendas.</p>
        </div>
        <Button onClick={openCreateFunnel} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Funil
        </Button>
      </div>

      {funnels.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Nenhum funil cadastrado. Crie o primeiro funil para configurar suas etapas de vendas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          {/* ── Left: Funnel list ── */}
          <div className="space-y-1 rounded-lg border p-2">
            {funnels.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                  selectedId === f.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{f.name}</span>
                <div className="flex items-center gap-1">
                  {f.is_default && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  )}
                  {!f.is_active && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Inativo
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
              </button>
            ))}
          </div>

          {/* ── Right: Selected funnel detail ── */}
          {selectedFunnel ? (
            <div className="rounded-lg border p-4 space-y-4">
              {/* Funnel header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-base">{selectedFunnel.name}</h4>
                  {selectedFunnel.is_default && (
                    <Badge variant="secondary" className="text-xs">Padrão</Badge>
                  )}
                  {!selectedFunnel.is_active && (
                    <Badge variant="destructive" className="text-xs">Inativo</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditFunnel(selectedFunnel)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Renomear
                  </Button>
                  {!selectedFunnel.is_default && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(selectedFunnel)}>
                      <Star className="h-3.5 w-3.5 mr-1" />
                      Tornar Padrão
                    </Button>
                  )}
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={selectedFunnel.is_active}
                      onCheckedChange={() => handleToggleFunnelActive(selectedFunnel)}
                      disabled={selectedFunnel.is_default && selectedFunnel.is_active}
                    />
                  </div>
                </div>
              </div>

              {/* Stages */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {sortedStages.length} etapa{sortedStages.length !== 1 ? "s" : ""}
                </p>
                <Button size="sm" variant="outline" onClick={openCreateStage}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Nova Etapa
                </Button>
              </div>

              {sortedStages.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Adicione etapas para configurar o funil.
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedStages.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                        !stage.is_active && "opacity-50 bg-muted/30"
                      )}
                    >
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === 0}
                          onClick={() => handleMoveStage(stage, "up")}
                          aria-label="Mover para cima"
                        >
                          <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 5l4-4 4 4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === sortedStages.length - 1}
                          onClick={() => handleMoveStage(stage, "down")}
                          aria-label="Mover para baixo"
                        >
                          <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>

                      <GripVertical className="h-4 w-4 text-muted-foreground/40" />

                      {/* Name */}
                      <span className={cn("flex-1 font-medium", !stage.is_active && "line-through")}>
                        {stage.name}
                      </span>

                      {/* Badges */}
                      {stage.is_won_stage && (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0 gap-1">
                          <Trophy className="h-3 w-3" /> Ganho
                        </Badge>
                      )}
                      {stage.is_lost_stage && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-[10px] px-1.5 py-0 gap-1">
                          <XCircle className="h-3 w-3" /> Perdido
                        </Badge>
                      )}
                      {(stage.opportunity_count || 0) > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {stage.opportunity_count} oport.
                        </Badge>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditStage(stage)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={stage.is_won_stage ? "Remover como ganho" : "Marcar como ganho"}
                          onClick={() => handleToggleWon(stage)}
                        >
                          <Trophy className={cn("h-3.5 w-3.5", stage.is_won_stage ? "text-emerald-600" : "text-muted-foreground")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={stage.is_lost_stage ? "Remover como perdido" : "Marcar como perdido"}
                          onClick={() => handleToggleLost(stage)}
                        >
                          <XCircle className={cn("h-3.5 w-3.5", stage.is_lost_stage ? "text-red-600" : "text-muted-foreground")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={stage.is_active ? "Desativar" : "Reativar"}
                          onClick={() => confirmDeactivateStage(stage)}
                        >
                          <Archive className={cn("h-3.5 w-3.5", !stage.is_active ? "text-amber-600" : "text-muted-foreground")} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Selecione um funil para gerenciar suas etapas.
            </div>
          )}
        </div>
      )}

      {/* ── Funnel Dialog ── */}
      <Dialog open={funnelDialogOpen} onOpenChange={setFunnelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFunnel ? "Renomear Funil" : "Novo Funil"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveFunnel} className="space-y-4">
            <Input
              placeholder="Nome do funil"
              value={funnelName}
              onChange={(e) => setFunnelName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFunnelDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!funnelName.trim() || saving}>
                {editingFunnel ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Stage Dialog ── */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStage ? "Renomear Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveStage} className="space-y-4">
            <Input
              placeholder="Nome da etapa"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              autoFocus
            />
            {!editingStage && stageName.trim() && (
              <p className="text-xs text-muted-foreground">
                Chave: <code className="bg-muted px-1 rounded">{slugify(stageName.trim())}</code>
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStageDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!stageName.trim() || saving}>
                {editingStage ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Stage Confirm ── */}
      <AlertDialog open={!!deactivateStage} onOpenChange={(o) => !o && setDeactivateStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateStage?.is_active ? "Desativar" : "Reativar"} etapa "{deactivateStage?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateStage?.is_active && (deactivateStage?.opportunity_count || 0) > 0
                ? `Esta etapa possui ${deactivateStage.opportunity_count} oportunidade(s) ativa(s). Elas permanecerão vinculadas, mas a etapa não aparecerá mais como opção para novas oportunidades. Recomenda-se mover as oportunidades antes de desativar.`
                : deactivateStage?.is_active
                  ? "A etapa será ocultada do funil e não poderá receber novas oportunidades."
                  : "A etapa será reativada e voltará a aparecer no funil."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateStage} disabled={saving}>
              {deactivateStage?.is_active ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
