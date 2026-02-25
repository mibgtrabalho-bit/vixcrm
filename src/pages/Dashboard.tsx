import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, TrendingUp, Users, Kanban } from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalOpportunities: 0,
    totalValue: 0,
    closedValue: 0,
    totalContacts: 0,
  });

  useEffect(() => {
    if (profile?.tenant_id) fetchStats();
  }, [profile?.tenant_id]);

  const fetchStats = async () => {
    const { data: opps } = await supabase
      .from("opportunities")
      .select("id, value, stage");

    const { count: contactCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true });

    const opportunities = opps || [];
    const totalValue = opportunities.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
    const closedValue = opportunities
      .filter((o) => o.stage === "fechado")
      .reduce((sum, o) => sum + (Number(o.value) || 0), 0);

    setStats({
      totalOpportunities: opportunities.length,
      totalValue,
      closedValue,
      totalContacts: contactCount || 0,
    });
  };

  const cards = [
    {
      title: "Oportunidades",
      value: stats.totalOpportunities,
      icon: Kanban,
      format: "number" as const,
    },
    {
      title: "Valor Total no Pipeline",
      value: stats.totalValue,
      icon: TrendingUp,
      format: "currency" as const,
    },
    {
      title: "Vendas Fechadas",
      value: stats.closedValue,
      icon: DollarSign,
      format: "currency" as const,
    },
    {
      title: "Contatos",
      value: stats.totalContacts,
      icon: Users,
      format: "number" as const,
    },
  ];

  const formatValue = (val: number, format: "number" | "currency") => {
    if (format === "currency") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(val);
    }
    return val.toString();
  };

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do seu pipeline de vendas" />

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatValue(card.value, card.format)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
