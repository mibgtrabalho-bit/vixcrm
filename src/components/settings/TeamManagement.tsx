import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";

interface TeamRow {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
}

export function TeamManagement() {
  const { profile, role } = useAuth();
  const { toast } = useToast();
  const isDirector = role === "diretor";

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!profile?.tenant_id) return;

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, created_at")
      .order("name");

    const { data: members } = await supabase
      .from("team_members")
      .select("team_id");

    const countMap = new Map<string, number>();
    (members || []).forEach((m: any) => {
      countMap.set(m.team_id, (countMap.get(m.team_id) || 0) + 1);
    });

    setTeams(
      (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        created_at: t.created_at,
        member_count: countMap.get(t.id) || 0,
      }))
    );
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName("");
    setDialogOpen(true);
  };

  const openEdit = (team: TeamRow) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !teamName.trim()) return;
    setLoading(true);

    if (editingTeam) {
      const { error } = await supabase
        .from("teams")
        .update({ name: teamName.trim() })
        .eq("id", editingTeam.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Time renomeado" });
        setDialogOpen(false);
        fetchTeams();
      }
    } else {
      const { error } = await supabase
        .from("teams")
        .insert({ name: teamName.trim(), tenant_id: profile.tenant_id });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Time criado" });
        setDialogOpen(false);
        fetchTeams();
      }
    }
    setLoading(false);
  };

  if (!isDirector) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Times de Vendas</h3>
          <p className="text-sm text-muted-foreground">Crie e gerencie os times da sua empresa.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Criar Time
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Membros</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum time cadastrado. Crie o primeiro time para poder convidar usuários.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.member_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Renomear Time" : "Criar Time"}</DialogTitle>
            <DialogDescription>
              {editingTeam ? "Altere o nome do time." : "Defina o nome do novo time de vendas."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="team-name">Nome do Time</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ex: Vendas A"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !teamName.trim()}>
                {editingTeam ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
