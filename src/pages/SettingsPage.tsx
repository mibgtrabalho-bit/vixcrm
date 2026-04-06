import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccessManagement } from "@/components/settings/AccessManagement";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { FunnelManagement } from "@/components/settings/FunnelManagement";
import { useAuth } from "@/contexts/AuthContext";
import { Users, GitBranch, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type SettingsSection = "home" | "teams" | "funnels" | "access";

const sections = [
  {
    id: "teams" as const,
    title: "Times de Vendas",
    description: "Gerencie times, membros e estrutura comercial",
    icon: Users,
  },
  {
    id: "funnels" as const,
    title: "Funis de Vendas",
    description: "Configure funis, etapas e fluxos do pipeline",
    icon: GitBranch,
  },
  {
    id: "access" as const,
    title: "Gestão de Acessos",
    description: "Controle convites, papéis e permissões de usuários",
    icon: ShieldCheck,
  },
];

const sectionComponents: Record<Exclude<SettingsSection, "home">, React.FC> = {
  teams: TeamManagement,
  funnels: FunnelManagement,
  access: AccessManagement,
};

export default function SettingsPage() {
  const { role } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>("home");

  const visibleSections = sections.filter((s) => {
    if (s.id === "funnels" && role !== "diretor") return false;
    return true;
  });

  if (activeSection !== "home") {
    const ActiveComponent = sectionComponents[activeSection];
    const sectionMeta = sections.find((s) => s.id === activeSection);

    return (
      <AppLayout>
        <PageHeader title={sectionMeta?.title ?? "Configurações"} description={sectionMeta?.description}>
          <Button variant="ghost" size="sm" onClick={() => setActiveSection("home")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </PageHeader>
        <div className="p-6">
          <ActiveComponent />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Configurações" description="Gerencie sua conta e empresa" />
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="group relative flex flex-col items-start gap-4 rounded-xl border border-border/60 bg-card p-6 text-left transition-all duration-200 ease-out hover:border-primary/40 hover:bg-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background aspect-square sm:aspect-[4/3]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold text-foreground leading-tight">{section.title}</span>
                  <span className="text-[13px] text-muted-foreground leading-snug">{section.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
