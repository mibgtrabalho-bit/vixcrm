import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
import { Plus, Search, Globe, Building2, Trash2, Pencil } from "lucide-react";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  website: string | null;
  address: string | null;
  contact_id: string;
  contact_name?: string;
  created_at: string;
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [contactId, setContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchCompanies();
      fetchContacts();
    }
  }, [profile?.tenant_id]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name, cnpj, website, address, contact_id, created_at, contacts:contact_id(name)")
      .order("created_at", { ascending: false });

    setCompanies(
      (data || []).map((c: any) => ({
        ...c,
        contact_name: c.contacts?.name,
      }))
    );
  };

  const fetchContacts = async () => {
    const { data } = await supabase.from("contacts").select("id, name");
    setContacts(data || []);
  };

  const resetForm = () => {
    setName("");
    setCnpj("");
    setAddress("");
    setWebsite("");
    setContactId("");
    setEditingCompany(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !contactId) {
      toast({
        title: "Contato obrigatório",
        description: "Selecione um contato para vincular à empresa.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    const { error } = await supabase.from("companies").insert({
      name,
      cnpj: cnpj || null,
      address: address || null,
      website: website || null,
      contact_id: contactId,
      tenant_id: profile.tenant_id,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa criada!" });
      fetchCompanies();
      setCreateOpen(false);
      resetForm();
    }
    setLoading(false);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setName(company.name);
    setCnpj(company.cnpj || "");
    setAddress(company.address || "");
    setWebsite(company.website || "");
    setContactId(company.contact_id);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !contactId) {
      toast({
        title: "Contato obrigatório",
        description: "Selecione um contato para vincular à empresa.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    const { error } = await supabase
      .from("companies")
      .update({
        name,
        cnpj: cnpj || null,
        address: address || null,
        website: website || null,
        contact_id: contactId,
      })
      .eq("id", editingCompany.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa atualizada!" });
      fetchCompanies();
      setEditOpen(false);
      resetForm();
    }
    setLoading(false);
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj?.includes(search)
  );

  const companyForm = (onSubmit: (e: React.FormEvent) => void, isEdit: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>Nome da empresa *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label>CNPJ</Label>
        <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
      </div>
      <div>
        <Label>Contato vinculado *</Label>
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o contato..." />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Endereço</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div>
        <Label>Website</Label>
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => { isEdit ? setEditOpen(false) : setCreateOpen(false); resetForm(); }}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (isEdit ? "Salvando..." : "Criando...") : (isEdit ? "Salvar" : "Criar")}
        </Button>
      </div>
    </form>
  );

  return (
    <AppLayout>
      <PageHeader title="Empresas" description="Gerencie as empresas do seu pipeline">
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </PageHeader>

      <div className="p-6">
        <div className="mb-4 relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {c.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{c.cnpj || "—"}</TableCell>
                    <TableCell className="text-sm">{c.contact_name || "—"}</TableCell>
                    <TableCell>
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="h-3 w-3" />
                          {c.website}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação irá remover a empresa da lista. Ela poderá ser restaurada posteriormente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                if (!user) return;
                                const { error } = await supabase.from("companies").update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq("id", c.id);
                                if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
                                else { toast({ title: "Empresa excluída" }); fetchCompanies(); }
                              }}>Confirmar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre uma empresa. O contato é obrigatório.</DialogDescription>
          </DialogHeader>
          {companyForm(handleCreate, false)}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>Atualize as informações da empresa.</DialogDescription>
          </DialogHeader>
          {companyForm(handleEdit, true)}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
