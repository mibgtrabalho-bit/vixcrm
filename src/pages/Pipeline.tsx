import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { CreateOpportunityDialog } from "@/components/pipeline/CreateOpportunityDialog";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List } from "lucide-react";

export default function Pipeline() {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Pipeline" description="Gerencie suas oportunidades de venda">
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => setViewMode("kanban")}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </PageHeader>

      <KanbanBoard key={refreshKey} />

      <CreateOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </AppLayout>
  );
}
