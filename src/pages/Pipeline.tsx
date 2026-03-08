import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { PipelineListView } from "@/components/pipeline/PipelineListView";
import { PipelineSummaryBar } from "@/components/pipeline/PipelineSummaryBar";
import { CreateOpportunityDialog } from "@/components/pipeline/CreateOpportunityDialog";
import { PipelineTeamFilter } from "@/components/pipeline/PipelineTeamFilter";
import { ExportCsvDialog } from "@/components/pipeline/ExportCsvDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Plus, LayoutGrid, List, Download } from "lucide-react";

export default function Pipeline() {
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
      <PageHeader title="Pipeline" description="Gerencie suas oportunidades de venda">
        <PipelineTeamFilter value={teamFilter} onChange={setTeamFilter} />
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5">
          <button
            onClick={() => setViewMode("kanban")}
            className={`rounded-md p-1.5 transition-apple ${
              viewMode === "kanban" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-md p-1.5 transition-apple ${
              viewMode === "list" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </PageHeader>

      <PipelineSummaryBar teamFilter={teamFilter} refreshKey={refreshKey} />

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
