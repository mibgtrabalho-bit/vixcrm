import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccessManagement } from "@/components/settings/AccessManagement";
import { TeamManagement } from "@/components/settings/TeamManagement";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader title="Configurações" description="Gerencie sua conta e empresa" />
      <div className="p-6 space-y-8">
        <TeamManagement />
        <AccessManagement />
      </div>
    </AppLayout>
  );
}
