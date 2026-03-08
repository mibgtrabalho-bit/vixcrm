import { useAuth } from "@/contexts/AuthContext";
import { PipelineTeamFilter } from "@/components/pipeline/PipelineTeamFilter";
import { PIPELINE_STAGES } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportsFilterBarProps {
  teamFilter: string;
  onTeamFilterChange: (value: string) => void;
  stageFilter: string;
  onStageFilterChange: (value: string) => void;
  periodFilter: string;
  onPeriodFilterChange: (value: string) => void;
}

export function ReportsFilterBar({
  teamFilter,
  onTeamFilterChange,
  stageFilter,
  onStageFilterChange,
  periodFilter,
  onPeriodFilterChange,
}: ReportsFilterBarProps) {
  const { role } = useAuth();

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border/60">
      {/* Period filter */}
      <Select value={periodFilter} onValueChange={onPeriodFilterChange}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current_month">Mês atual</SelectItem>
          <SelectItem value="last_month">Mês anterior</SelectItem>
          <SelectItem value="current_quarter">Trimestre atual</SelectItem>
          <SelectItem value="current_year">Ano atual</SelectItem>
        </SelectContent>
      </Select>

      {/* Team/user filter — hidden for sellers */}
      {role !== "vendedor" && (
        <PipelineTeamFilter value={teamFilter} onChange={onTeamFilterChange} />
      )}

      {/* Stage filter */}
      <Select value={stageFilter} onValueChange={onStageFilterChange}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder="Estágio" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estágios</SelectItem>
          {PIPELINE_STAGES.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
