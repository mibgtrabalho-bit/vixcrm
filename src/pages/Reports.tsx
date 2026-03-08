import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { ReportsFilterBar } from "@/components/reports/ReportsFilterBar";
import { SellerDashboard } from "@/components/reports/SellerDashboard";
import { ManagerDashboard } from "@/components/reports/ManagerDashboard";
import { DirectorDashboard } from "@/components/reports/DirectorDashboard";

const ROLE_LABELS: Record<string, string> = {
  vendedor: "Dashboard do Vendedor",
  gestor: "Dashboard do Gestor",
  diretor: "Dashboard do Diretor",
};

export default function Reports() {
  const { role, loading } = useAuth();
  const [teamFilter, setTeamFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("current_month");

  if (loading) return null;
  if (!role) return <Navigate to="/auth" replace />;

  const filters = { period: periodFilter, stage: stageFilter, team: teamFilter };

  return (
    <AppLayout>
      <PageHeader
        title="Relatórios"
        description={ROLE_LABELS[role] || "Relatórios"}
      />

      <ReportsFilterBar
        teamFilter={teamFilter}
        onTeamFilterChange={setTeamFilter}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        periodFilter={periodFilter}
        onPeriodFilterChange={setPeriodFilter}
      />

      <div className="p-6">
        {role === "vendedor" && <SellerDashboard filters={filters} />}
        {role === "gestor" && <ManagerDashboard filters={filters} />}
        {role === "diretor" && <DirectorDashboard filters={filters} />}
      </div>
    </AppLayout>
  );
}
