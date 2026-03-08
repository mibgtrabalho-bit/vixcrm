import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Pencil, UserPlus, UserMinus, Users, Trash2 } from "lucide-react";

interface MemberInfo {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
  membership_id: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  created_at: string;
  members: MemberInfo[];
}

interface UnassignedUser {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
}

export function TeamManagement() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const isDirector = role === "diretor";

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignableUsers, setAssignableUsers] = useState<UnassignedUser[]>([]);

  // Move dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveMember, setMoveMember] = useState<MemberInfo | null>(null);
  const [moveFromTeamId, setMoveFromTeamId] = useState("");
  const [moveToTeamId, setMoveToTeamId] = useState("");

  const fetchAll = useCallback(async () => {
    if (!profile?.tenant_id) return;

    const [{ data: teamsData }, { data: members }, { data: profiles }, { data: roles }] =
      await Promise.all([
        supabase.from("teams").select("id, name, created_at").order("name"),
        supabase.from("team_members").select("id, team_id, user_id"),
        supabase.from("profiles").select("user_id, full_name, email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, { full_name: p.full_name, email: p.email }])
    );

    const teamMembersMap = new Map<string, MemberInfo[]>();
    const assignedUserIds = new Set<string>();

    (members || []).forEach((m: any) => {
      const prof = profileMap.get(m.user_id);
      if (!prof) return;
      assignedUserIds.add(m.user_id);
      const info: MemberInfo = {
        user_id: m.user_id,
        full_name: prof.full_name,
        email: prof.email,
        role: roleMap.get(m.user_id) || null,
        membership_id: m.id,
      };
      const existing = teamMembersMap.get(m.team_id) || [];
      existing.push(info);
      teamMembersMap.set(m.team_id, existing);
    });

    const teamRows: TeamRow[] = (teamsData || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at,
      members: teamMembersMap.get(t.id) || [],
    }));

    // For non-directors, filter to only their teams
    if (role === "gestor") {
      const myTeamIds = new Set(
        (members || []).filter((m: any) => m.user_id === user?.id).map((m: any) => m.team_id)
      );
      setTeams(teamRows.filter((t) => myTeamIds.has(t.id)));
    } else if (role === "vendedor") {
      const myTeamIds = new Set(
        (members || []).filter((m: any) => m.user_id === user?.id).map((m: any) => m.team_id)
      );
      setTeams(teamRows.filter((t) => myTeamIds.has(t.id)));
    } else {
      setTeams(teamRows);
    }

    // Unassigned: non-director users without any team membership (director only sees this)
    if (isDirector) {
      const unassignedUsers: UnassignedUser[] = (profiles || [])
        .filter((p: any) => {
          const r = roleMap.get(p.user_id);
          return r !== "diretor" && !assignedUserIds.has(p.user_id);
        })
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          role: roleMap.get(p.user_id) || null,
        }));
      setUnassigned(unassignedUsers);
    }
  }, [profile?.tenant_id, role, user?.id, isDirector]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Create / Rename team
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
        fetchAll();
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
        fetchAll();
      }
    }
    setLoading(false);
  };

  // Delete team
  const handleDeleteTeam = async (team: TeamRow) => {
    setLoading(true);
    // First remove all members
    if (team.members.length > 0) {
      const memberIds = team.members.map((m) => m.membership_id).filter(Boolean) as string[];
      if (memberIds.length > 0) {
        const { error: memError } = await supabase
          .from("team_members")
          .delete()
          .in("id", memberIds);
        if (memError) {
          toast({ title: "Erro ao remover membros", description: memError.message, variant: "destructive" });
          setLoading(false);
          return;
        }
      }
    }
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) {
      toast({ title: "Erro ao excluir time", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Time excluído" });
      fetchAll();
    }
    setLoading(false);
  };

  // Assign user to team
  const openAssign = (teamId: string) => {
    setAssignTeamId(teamId);
    setAssignUserId("");
    setAssignableUsers(unassigned);
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignUserId || !assignTeamId) return;
    setLoading(true);
    const { error } = await supabase
      .from("team_members")
      .insert({ user_id: assignUserId, team_id: assignTeamId });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro adicionado ao time" });
      setAssignOpen(false);
      fetchAll();
    }
    setLoading(false);
  };

  // Remove from team
  const handleRemove = async (membershipId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", membershipId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro removido do time" });
      fetchAll();
    }
    setLoading(false);
  };

  // Move user between teams
  const openMove = (member: MemberInfo, fromTeamId: string) => {
    setMoveMember(member);
    setMoveFromTeamId(fromTeamId);
    setMoveToTeamId("");
    setMoveOpen(true);
  };

  const handleMove = async () => {
    if (!moveMember?.membership_id || !moveToTeamId) return;
    setLoading(true);
    const { error } = await supabase
      .from("team_members")
      .update({ team_id: moveToTeamId })
      .eq("id", moveMember.membership_id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro movido para outro time" });
      setMoveOpen(false);
      fetchAll();
    }
    setLoading(false);
  };

  const roleLabel = (r: string | null) => {
    switch (r) {
      case "vendedor": return "Vendedor";
      case "gestor": return "Gestor";
      case "diretor": return "Diretor";
      default: return "—";
    }
  };

  // Sellers: hide the team section entirely
  if (role === "vendedor") {
    return null;
  }

  // Read-only view for managers
  if (role === "gestor") {
    if (teams.length === 0) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Meu Time</h3>
          <p className="text-sm text-muted-foreground">Membros do seu time de vendas.</p>
        </div>
        {teams.map((team) => (
          <div key={team.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{team.name}</span>
              <Badge variant="secondary">
                {team.members.length} membro{team.members.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {team.members.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cargo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.members.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">{m.full_name}</TableCell>
                      <TableCell className="text-sm">{m.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Director full management view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Times de Vendas</h3>
          <p className="text-sm text-muted-foreground">Crie times e gerencie seus membros.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Criar Time
        </Button>
      </div>

      {/* Unassigned users alert */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {unassigned.length} usuário(s) sem time atribuído:
          </p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">
            {unassigned.map((u) => u.full_name).join(", ")}
          </p>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Nenhum time cadastrado. Crie o primeiro time para organizar sua equipe.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {teams.map((team) => (
            <AccordionItem key={team.id} value={team.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{team.name}</span>
                  <Badge variant="secondary" className="ml-1">
                    {team.members.length} membro{team.members.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-4 space-y-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(team)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Renomear
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openAssign(team.id)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Adicionar Membro
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir time "{team.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {team.members.length > 0
                              ? `Este time possui ${team.members.length} membro(s). Eles serão desvinculados e ficarão sem time atribuído.`
                              : "Esta ação não pode ser desfeita."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTeam(team)}>
                            Confirmar Exclusão
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {team.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhum membro neste time.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead className="w-28">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {team.members.map((m) => (
                          <TableRow key={m.user_id}>
                            <TableCell className="font-medium">{m.full_name}</TableCell>
                            <TableCell className="text-sm">{m.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {teams.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => openMove(m, team.id)}
                                  >
                                    Mover
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => m.membership_id && handleRemove(m.membership_id)}
                                >
                                  <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Create / Rename Dialog */}
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

      {/* Assign Member Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
            <DialogDescription>Selecione um usuário sem time para adicionar.</DialogDescription>
          </DialogHeader>
          {assignableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Todos os vendedores e gestores já estão atribuídos a um time.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Usuário</Label>
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name} ({roleLabel(u.role)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
                <Button onClick={handleAssign} disabled={loading || !assignUserId}>Adicionar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Member Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover Membro</DialogTitle>
            <DialogDescription>
              Mover <strong>{moveMember?.full_name}</strong> para outro time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Novo Time</Label>
              <Select value={moveToTeamId} onValueChange={setMoveToTeamId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((t) => t.id !== moveFromTeamId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
              <Button onClick={handleMove} disabled={loading || !moveToTeamId}>Mover</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
