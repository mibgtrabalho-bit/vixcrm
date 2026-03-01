import { Droppable } from "@hello-pangea/dnd";
import { OpportunityCard, Opportunity } from "./OpportunityCard";

interface Props {
  stageId: string;
  label: string;
  color: string;
  opportunities: Opportunity[];
  onCardClick?: (opp: Opportunity) => void;
}

export function KanbanColumn({ stageId, label, color, opportunities, onCardClick }: Props) {
  const totalValue = opportunities.reduce((sum, o) => sum + (o.value || 0), 0);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: `hsl(${color})` }}
          />
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
            {opportunities.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-xs text-muted-foreground">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              notation: "compact",
            }).format(totalValue)}
          </span>
        )}
      </div>

      {/* Cards */}
      <Droppable droppableId={stageId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2 overflow-y-auto px-2 pb-2 min-h-[100px] transition-colors rounded-b-lg ${
              snapshot.isDraggingOver ? "bg-primary/5" : ""
            }`}
          >
            {opportunities.map((opp, index) => (
              <OpportunityCard key={opp.id} opportunity={opp} index={index} onClick={onCardClick} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
