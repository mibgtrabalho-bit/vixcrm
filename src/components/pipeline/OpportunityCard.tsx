import { Draggable } from "@hello-pangea/dnd";
import { Building2, DollarSign, Calendar, User, Users, Clock, AlertTriangle, Phone, Mail, CalendarCheck, FileText, MoreHorizontal } from "lucide-react";

export interface Opportunity {
  id: string;
  title: string;
  value: number | null;
  value_implantacao: number | null;
  value_saas: number | null;
  company_name?: string;
  contact_name?: string;
  assigned_to_name?: string;
  team_name?: string;
  expected_close_date?: string;
  stage: string;
  notes?: string;
  contact_id?: string;
  company_id?: string;
  assigned_to?: string;
  first_payment_date?: string;
  created_at?: string;
  last_activity_at?: string;
}

interface Props {
  opportunity: Opportunity;
  index: number;
  onClick?: (opp: Opportunity) => void;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function getInactivityState(opportunity: Opportunity): "normal" | "warning" | "critical" {
  const ref = opportunity.last_activity_at || opportunity.created_at;
  if (!ref) return "normal";
  const now = Date.now();
  const diffMs = now - new Date(ref).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays >= 5) return "critical";
  if (diffDays >= 3) return "warning";
  return "normal";
}

const inactivityStyles = {
  normal: "",
  warning: "border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-500/40",
  critical: "border-red-400/70 bg-red-50/60 dark:bg-red-950/20 dark:border-red-500/40",
};

export function OpportunityCard({ opportunity, index, onClick }: Props) {
  const state = getInactivityState(opportunity);

  return (
    <Draggable draggableId={opportunity.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(opportunity)}
          className={`rounded-xl border p-3.5 shadow-xs transition-apple cursor-pointer ${
            inactivityStyles[state] || "border-border/50 bg-card"
          } ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary/15 scale-[1.02]" : "hover:shadow-sm hover:border-border"
          }`}
        >
          <h4 className="text-[13px] font-medium text-foreground leading-tight">
            {opportunity.title}
          </h4>

          {opportunity.company_name && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{opportunity.company_name}</span>
            </div>
          )}

          {(opportunity.value_implantacao || opportunity.value_saas) ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-foreground">
              {opportunity.value_implantacao != null && opportunity.value_implantacao > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-[hsl(var(--success))]" />
                  Impl: {fmt.format(opportunity.value_implantacao)}
                </span>
              )}
              {opportunity.value_saas != null && opportunity.value_saas > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-primary" />
                  SaaS: {fmt.format(opportunity.value_saas)}
                </span>
              )}
            </div>
          ) : opportunity.value != null && opportunity.value > 0 ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
              <DollarSign className="h-3 w-3 text-[hsl(var(--success))]" />
              <span>{fmt.format(opportunity.value)}</span>
            </div>
          ) : null}

          {(opportunity.assigned_to_name || opportunity.team_name) && (
            <div className="mt-2 flex items-center gap-2.5 text-[11px] text-muted-foreground">
              {opportunity.assigned_to_name && (
                <div className="flex items-center gap-1 min-w-0">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[90px]">{opportunity.assigned_to_name}</span>
                </div>
              )}
              {opportunity.team_name && (
                <div className="flex items-center gap-1 min-w-0">
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[80px]">{opportunity.team_name}</span>
                </div>
              )}
            </div>
          )}

          {opportunity.expected_close_date && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(opportunity.expected_close_date).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>
          )}

          {opportunity.created_at && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              <span>
                Criado em{" "}
                {new Date(opportunity.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}{" "}
                {new Date(opportunity.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
