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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  UserPlus,
  Copy,
  RotateCcw,
  XCircle,
  UserCheck,
  UserX,
  Check,
} from "lucide-react";

interface TeamOption {
  id: string;
  name: string;
}

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: string | null;
  team_name: string | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
  team_name: string | null;
}

export function AccessManagement() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const isDirector = role === "diretor";
  const isManager = role === "gestor";
  const canManage = isDirector || isManager;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("vendedor");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [tenantCnpj, setTenantCnpj] = useState<string>("");
  const [cnpjSaved, setCnpjSaved] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profile?.tenant_id) return;

    // Fetch profiles + roles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, is_active");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    // First get the current user's team IDs (for manager scoping)
    const { data: myTeams } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user?.id ?? "");

    const myTeamIds = new Set((myTeams || []).map((t: any) => t.team_id));

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("user_id, team_id, teams:team_id(name)");

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name");

    // Fetch tenant CNPJ
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("cnpj")
      .eq("id", profile.tenant_id)
      .single();

    if (tenantData?.cnpj) {
      setTenantCnpj(tenantData.cnpj);
      setCnpjSaved(true);
    }

    setTeams(teamsData || []);

    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    const teamMap = new Map(
      (teamMembers || []).map((tm: any) => [tm.user_id, (tm.teams as any)?.name || null])
    );

    const userRows: UserRow[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
      is_active: p.is_active ?? true,
      role: roleMap.get(p.user_id) || null,
      team_name: teamMap.get(p.user_id) || null,
    }));

    // Manager: filter to only users who share a team with the manager
    if (isManager && !isDirector) {
      const usersInMyTeams = new Set(
        (teamMembers || [])
          .filter((tm: any) => myTeamIds.has(tm.team_id))
          .map((tm: any) => tm.user_id)
      );
      setUsers(userRows.filter((u) => usersInMyTeams.has(u.user_id) || u.user_id === user?.id));
    } else {
      setUsers(userRows);
    }

    // Fetch invitations
    const { data: invs } = await supabase
      .from("invitations")
      .select("id, email, role, status, token, created_at, teams:team_id(name)")
      .order("created_at", { ascending: false });

    setInvitations(
      (invs || []).map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        token: inv.token,
        created_at: inv.created_at,
        team_name: (inv.teams as any)?.name || null,
      }))
    );
  }, [profile?.tenant_id, isManager, isDirector, user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const validateCnpj = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.length === 14;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const needsTeam = inviteRole !== "diretor";
    if (needsTeam && !inviteTeamId) {
      toast({ title: "Time obrigatório", description: "Selecione um time para o convite.", variant: "destructive" });
      return;
    }
    if (!tenantCnpj || !validateCnpj(tenantCnpj)) {
      toast({ title: "CNPJ inválido", description: "Informe um CNPJ válido com 14 dígitos.", variant: "destructive" });
      return;
    }
    setInviteLoading(true);

    // Save CNPJ to tenant if not yet saved
    if (!cnpjSaved) {
      const { error: cnpjError } = await supabase
        .from("tenants")
        .update({ cnpj: tenantCnpj.replace(/\D/g, "") } as any)
        .eq("id", profile.tenant_id);
      if (cnpjError) {
        toast({ title: "Erro ao salvar CNPJ", description: cnpjError.message, variant: "destructive" });
        setInviteLoading(false);
        return;
      }
      setCnpjSaved(true);
    }

    const { data, error } = await supabase
      .from("invitations")
      .insert({
      tenant_id: profile.tenant_id,
      email: inviteEmail,
      role: inviteRole as any,
      team_id: inviteRole === "diretor" ? null : inviteTeamId,
      invited_by: user.id,
      })
      .select("token")
      .single();

    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
    } else {
      const link = `${window.location.origin}/auth?invite=${data.token}`;
      setGeneratedLink(link);
      toast({ title: "Convite criado!" });
      fetchAll();
    }
    setInviteLoading(false);
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user?.id } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite revogado" });
      fetchAll();
    }
  };

  const resendInvite = async (inv: InvitationRow) => {
    copyLink(inv.token);
  };

  const toggleUserActive = async (targetUserId: string, currentlyActive: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !currentlyActive })
      .eq("user_id", targetUserId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentlyActive ? "Usuário desativado" : "Usuário reativado" });
      fetchAll();
    }
  };

  const roleLabel = (r: string | null) => {
    switch (r) {
      case "vendedor": return "Vendedor";
      case "gestor": return "Gestor";
      case "diretor": return "Diretor";
      default: return "—";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pendente</Badge>;
      case "accepted":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Aceito</Badge>;
      case "revoked":
        return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">Revogado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!canManage) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Apenas gestores e diretores podem gerenciar acessos.
      </div>
    );
  }

  const availableRoles = isDirector
    ? [{ value: "vendedor", label: "Vendedor" }, { value: "gestor", label: "Gestor" }, { value: "diretor", label: "Diretor" }]
    : [{ value: "vendedor", label: "Vendedor" }];

  const teamRequired = inviteRole !== "diretor";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestão de Acessos</h3>
          <p className="text-sm text-muted-foreground">Gerencie usuários e convites da sua empresa.</p>
        </div>
        <Button onClick={() => { setInviteOpen(true); setGeneratedLink(null); setInviteEmail(""); setInviteRole("vendedor"); setInviteTeamId(""); }} size="sm">
          <UserPlus className="h-4 w-4 mr-1" />
          Convidar Usuário
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="invitations">Convites</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.user_id} className={!u.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell><Badge variant="secondary">{roleLabel(u.role)}</Badge></TableCell>
                      <TableCell className="text-sm">{u.team_name || "—"}</TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.user_id !== user?.id && (isDirector || (isManager && u.role !== 'gestor' && u.role !== 'diretor')) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                {u.is_active ? <UserX className="h-4 w-4 text-muted-foreground" /> : <UserCheck className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{u.is_active ? "Desativar usuário?" : "Reativar usuário?"}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.is_active
                                    ? `${u.full_name} não poderá acessar o sistema até ser reativado.`
                                    : `${u.full_name} poderá acessar o sistema novamente.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => toggleUserActive(u.user_id, u.is_active)}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="invitations">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum convite enviado
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="secondary">{roleLabel(inv.role)}</Badge></TableCell>
                      <TableCell className="text-sm">{inv.team_name || "—"}</TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {inv.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Copiar link"
                                onClick={() => copyLink(inv.token)}
                              >
                                {copiedToken === inv.token ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Revogar">
                                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
                                    <AlertDialogDescription>O link de convite para {inv.email} será invalidado.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => revokeInvite(inv.id)}>Revogar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {inv.status === "revoked" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Reenviar"
                              onClick={() => resendInvite(inv)}
                            >
                              <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
            <DialogDescription>Gere um link de convite para adicionar um novo membro.</DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Convite criado! Copie o link abaixo e envie ao usuário:</p>
              <div className="flex gap-2">
                <Input readOnly value={generatedLink} className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    toast({ title: "Link copiado!" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Fechar</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label>CNPJ da Empresa *</Label>
                <Input
                  value={tenantCnpj}
                  onChange={(e) => setTenantCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  required
                  readOnly={cnpjSaved}
                  maxLength={18}
                />
                {cnpjSaved && (
                  <p className="text-xs text-muted-foreground mt-1">CNPJ já cadastrado para esta empresa.</p>
                )}
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {teamRequired && (
                <div>
                  <Label>Time *</Label>
                  <Select value={inviteTeamId} onValueChange={setInviteTeamId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o time..." /></SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? "Criando..." : "Gerar Convite"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
