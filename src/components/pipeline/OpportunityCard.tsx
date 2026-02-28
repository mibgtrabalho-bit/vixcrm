import { Draggable } from "@hello-pangea/dnd";
import { Building2, DollarSign, Calendar, User } from "lucide-react";

export interface Opportunity {
  id: string;
  title: string;
  value: number | null;
  value_implantacao: number | null;
  value_saas: number | null;
  company_name?: string;
  contact_name?: string;
  assigned_to_name?: string;
  expected_close_date?: string;
  stage: string;
}

interface Props {
  opportunity: Opportunity;
  index: number;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function OpportunityCard({ opportunity, index }: Props) {
  return (
    <Draggable draggableId={opportunity.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : "hover:shadow-md"
          }`}
        >
          <h4 className="text-sm font-medium text-foreground leading-tight">
            {opportunity.title}
          </h4>

          {opportunity.company_name && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{opportunity.company_name}</span>
            </div>
          )}

          {(opportunity.value_implantacao || opportunity.value_saas) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-foreground">
              {opportunity.value_implantacao != null && opportunity.value_implantacao > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-[hsl(var(--success))]" />
                  Impl: {fmt.format(opportunity.value_implantacao)}
                </span>
              )}
              {opportunity.value_saas != null && opportunity.value_saas > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-primary" />
                  SaaS: {fmt.format(opportunity.value_saas)}/mês
                </span>
              )}
            </div>
          ) : opportunity.value != null && opportunity.value > 0 ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
              <DollarSign className="h-3 w-3 text-[hsl(var(--success))]" />
              <span>{fmt.format(opportunity.value)}</span>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between">
            {opportunity.assigned_to_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{opportunity.assigned_to_name}</span>
              </div>
            )}
            {opportunity.expected_close_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(opportunity.expected_close_date).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
