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
import { Plus, Search, Mail, Phone, Trash2, Pencil } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.tenant_id) fetchContacts();
  }, [profile?.tenant_id]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false });
    setContacts(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setLoading(true);

    const { error } = await supabase.from("contacts").insert({
      name,
      email: email || null,
      phone: phone || null,
      tenant_id: profile.tenant_id,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contato criado!" });
      fetchContacts();
      setCreateOpen(false);
      resetForm();
    }
    setLoading(false);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setName(contact.name);
    setEmail(contact.email || "");
    setPhone(contact.phone || "");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setLoading(true);

    const { error } = await supabase
      .from("contacts")
      .update({
        name,
        email: email || null,
        phone: phone || null,
      })
      .eq("id", editingContact.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contato atualizado!" });
      fetchContacts();
      setEditOpen(false);
      resetForm();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setEditingContact(null);
  };

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader title="Contatos" description="Gerencie seus leads e decisores">
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm">
          <Plus className="h-4 w-4" />
          Novo Contato
        </Button>
      </PageHeader>

      <div className="p-6">
        <div className="mb-4 relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {c.email && (
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.phone && (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
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
                              <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação irá remover o contato da lista. Ele poderá ser restaurado posteriormente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                if (!user) return;
                                const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq("id", c.id);
                                if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
                                else { toast({ title: "Contato excluído" }); fetchContacts(); }
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
            <DialogTitle>Novo Contato</DialogTitle>
            <DialogDescription>Cadastre um novo lead ou decisor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Nome do decisor *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
            <DialogDescription>Atualize as informações do contato.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>Nome do decisor *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => { setEditOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
