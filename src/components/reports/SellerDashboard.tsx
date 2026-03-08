import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Target, TrendingUp, Repeat } from "lucide-react";

interface SellerDashboardProps {
  filters: { period: string; stage: string; team: string };
}

export function SellerDashboard({ filters }: SellerDashboardProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dashboard do Vendedor</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta SaaS</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta Setup</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Realizadas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Dados detalhados serão populados na próxima iteração.
      </p>
    </div>
  );
}
