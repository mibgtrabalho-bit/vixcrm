import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";

export default function Goals() {
  return (
    <AppLayout>
      <PageHeader title="Metas" description="Acompanhe suas metas de vendas" />
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Metas serão implementadas na Fase 2.
      </div>
    </AppLayout>
  );
}
