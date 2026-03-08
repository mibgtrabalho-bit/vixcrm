import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StrategicSummary } from "@/components/home/StrategicSummary";
import { PriorityBlock } from "@/components/home/PriorityBlock";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { PipelineListView } from "@/components/pipeline/PipelineListView";
import { CreateOpportunityDialog } from "@/components/pipeline/CreateOpportunityDialog";
import { PipelineTeamFilter } from "@/components/pipeline/PipelineTeamFilter";
import { ExportCsvDialog } from "@/components/pipeline/ExportCsvDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, LayoutGrid, List, Download } from "lucide-react";

function getHeaderDescription(role: string | null): string {
  if (role === "vendedor") return "Suas oportunidades de venda";
  if (role === "gestor") return "Pipeline do seu time";
  return "Visão operacional e estratégica";
}

export default function Dashboard() {
  const { role } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [refreshKey, setRefreshKey] = useState(0);
  const [teamFilter, setTeamFilter] = useState("all");

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Pipeline" description={getHeaderDescription(role)}>
        <PipelineTeamFilter value={teamFilter} onChange={setTeamFilter} />
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode("kanban")}
                aria-label="Kanban"
                className={`rounded-md p-1.5 transition-apple ${
                  viewMode === "kanban" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Kanban</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode("list")}
                aria-label="Lista"
                className={`rounded-md p-1.5 transition-apple ${
                  viewMode === "list" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Lista</TooltipContent>
          </Tooltip>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setExportOpen(true)}
              aria-label="Exportar CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Exportar CSV</TooltipContent>
        </Tooltip>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </PageHeader>

      <StrategicSummary teamFilter={teamFilter} />
      <PriorityBlock teamFilter={teamFilter} />

      {viewMode === "kanban" ? (
        <KanbanBoard key={refreshKey} teamFilter={teamFilter} />
      ) : (
        <PipelineListView key={refreshKey} teamFilter={teamFilter} />
      )}

      <CreateOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <ExportCsvDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        currentFilter={teamFilter}
      />
    </AppLayout>
  );
}
