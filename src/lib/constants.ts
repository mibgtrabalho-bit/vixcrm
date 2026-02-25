export const PIPELINE_STAGES = [
  { id: "prospeccao", label: "Prospecção", color: "var(--stage-prospeccao)" },
  { id: "follow_up", label: "Follow-up", color: "var(--stage-follow-up)" },
  { id: "agenda", label: "Agenda", color: "var(--stage-agenda)" },
  { id: "proposta", label: "Proposta", color: "var(--stage-proposta)" },
  { id: "negociacao", label: "Negociação", color: "var(--stage-negociacao)" },
  { id: "fechado", label: "Fechado", color: "var(--stage-fechado)" },
  { id: "perdido", label: "Perdido", color: "var(--stage-perdido)" },
] as const;

export type PipelineStageId = typeof PIPELINE_STAGES[number]["id"];
