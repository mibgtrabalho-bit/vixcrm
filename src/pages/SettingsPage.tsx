import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader title="Configurações" description="Gerencie sua conta e empresa" />
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Configurações serão expandidas em breve.
      </div>
    </AppLayout>
  );
}
