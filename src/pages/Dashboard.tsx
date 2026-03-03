import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, BarChart3, Repeat, Settings2, Zap, Target } from "lucide-react";

type WidgetId = "vendas_realizadas" | "vendas_projetadas" | "conversao" | "venda_saas" | "venda_implantacao" | "arr";

interface WidgetDef {
  id: WidgetId;
  label: string;
  icon: React.ElementType;
  format: "currency" | "percent";
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "vendas_realizadas", label: "Vendas Realizadas", icon: DollarSign, format: "currency" },
  { id: "vendas_projetadas", label: "Vendas Projetadas", icon: TrendingUp, format: "currency" },
  { id: "conversao", label: "Conversão de Vendas", icon: Target, format: "percent" },
  { id: "venda_saas", label: "Venda SaaS", icon: Repeat, format: "currency" },
  { id: "venda_implantacao", label: "Venda Implantação", icon: Zap, format: "currency" },
  { id: "arr", label: "ARR", icon: BarChart3, format: "currency" },
];

const STORAGE_KEY = "dashboard_widgets";
const DEFAULT_WIDGETS: WidgetId[] = ["vendas_realizadas", "vendas_projetadas", "conversao", "arr"];

async function fetchDashboardStats() {
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, value, value_implantacao, value_saas, first_payment_date, stage");

  const opportunities = opps || [];

  const fechados = opportunities.filter((o) => o.stage === "fechado");
  const negociacao = opportunities.filter((o) => o.stage === "negociacao");

  const vendasRealizadas = fechados.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const vendasProjetadas = negociacao.reduce((s, o) => s + (Number(o.value) || 0), 0);

  // Conversão: ONLY current stage = fechado / total
  const total = opportunities.length;
  const closedCount = fechados.length;
  const conversao = total > 0 ? (closedCount / total) * 100 : 0;

  const vendaSaas = fechados.reduce((s, o) => s + (Number(o.value_saas) || 0), 0);
  const vendaImpl = fechados.reduce((s, o) => s + (Number(o.value_implantacao) || 0), 0);

  // ARR
  const currentYear = new Date().getFullYear();
  const endOfYear = new Date(currentYear, 11, 31);
  let arr = 0;
  for (const o of fechados) {
    arr += Number(o.value_implantacao) || 0;
    const saasMonthly = Number(o.value_saas) || 0;
    if (saasMonthly > 0 && o.first_payment_date) {
      const firstDate = new Date(o.first_payment_date);
      if (firstDate <= endOfYear) {
        const startMonth = firstDate.getFullYear() === currentYear ? firstDate.getMonth() : 0;
        const months = 12 - startMonth;
        arr += saasMonthly * months;
      }
    }
  }

  return {
    vendas_realizadas: vendasRealizadas,
    vendas_projetadas: vendasProjetadas,
    conversao,
    venda_saas: vendaSaas,
    venda_implantacao: vendaImpl,
    arr,
  } as Record<WidgetId, number>;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetId[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });
  const [tempSelection, setTempSelection] = useState<WidgetId[]>([]);

  const { data: values } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    enabled: !!profile?.tenant_id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    initialData: {
      vendas_realizadas: 0,
      vendas_projetadas: 0,
      conversao: 0,
      venda_saas: 0,
      venda_implantacao: 0,
      arr: 0,
    },
  });

  const formatValue = (val: number, format: "currency" | "percent") => {
    if (format === "percent") return `${val.toFixed(1).replace(".", ",")}%`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const openConfig = () => {
    setTempSelection([...selectedWidgets]);
    setConfigOpen(true);
  };

  const toggleWidget = (id: WidgetId) => {
    setTempSelection((prev) => {
      if (prev.includes(id)) return prev.filter((w) => w !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const saveConfig = () => {
    setSelectedWidgets(tempSelection);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempSelection));
    setConfigOpen(false);
  };

  const activeWidgets = ALL_WIDGETS.filter((w) => selectedWidgets.includes(w.id));

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do seu pipeline de vendas">
        <Button variant="outline" size="sm" onClick={openConfig}>
          <Settings2 className="h-4 w-4 mr-1" />
          Configurar
        </Button>
      </PageHeader>

      <div className="p-6">
        <div className={`grid gap-4 sm:grid-cols-2 ${activeWidgets.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
          {activeWidgets.map((widget) => (
            <Card key={widget.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{widget.label}</CardTitle>
                <widget.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatValue(values[widget.id], widget.format)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar Dashboard</DialogTitle>
            <DialogDescription>Selecione até 4 indicadores para exibir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ALL_WIDGETS.map((w) => (
              <div key={w.id} className="flex items-center space-x-3">
                <Checkbox
                  id={w.id}
                  checked={tempSelection.includes(w.id)}
                  onCheckedChange={() => toggleWidget(w.id)}
                  disabled={!tempSelection.includes(w.id) && tempSelection.length >= 4}
                />
                <Label htmlFor={w.id} className="cursor-pointer">{w.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={saveConfig} disabled={tempSelection.length === 0}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
