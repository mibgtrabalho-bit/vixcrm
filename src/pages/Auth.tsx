import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Lock, User, ArrowRight, Users, Loader2 } from "lucide-react";

interface InviteData {
  id: string;
  email: string;
  role: string;
  team_id: string | null;
  tenant_id: string;
  team_name: string | null;
  tenant_name: string | null;
  tenant_cnpj: string | null;
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [isLogin, setIsLogin] = useState(!inviteToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;

    const validateInvite = async () => {
      setInviteLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("validate-invite", {
          body: { token: inviteToken },
        });
        if (error || data?.error) {
          setInviteError(data?.error || error?.message || "Erro ao validar convite");
        } else {
          setInviteData(data);
          setEmail(data.email);
          setIsLogin(false);
        }
      } catch (e: any) {
        setInviteError(e.message || "Erro ao validar convite");
      }
      setInviteLoading(false);
    };

    validateInvite();
  }, [inviteToken]);

  const roleLabel = (r: string) => {
    switch (r) {
      case "vendedor": return "Vendedor";
      case "gestor": return "Gestor";
      case "diretor": return "Diretor";
      default: return r;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else if (inviteData) {
        // Signup via invite
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: inviteData.email,
          password,
          options: {
            data: {
              full_name: fullName,
              tenant_id: inviteData.tenant_id,
              role: inviteData.role,
              team_id: inviteData.team_id,
              invite_token: inviteToken,
            },
          },
        });
        if (error) throw error;

        toast({
          title: "Conta criada!",
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      } else {
        // Normal signup (new director + new tenant)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
              role: "diretor",
            },
          },
        });
        if (error) throw error;

        toast({
          title: "Conta criada!",
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading invite validation
  if (inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Validando convite...</p>
        </div>
      </div>
    );
  }

  // Invalid invite
  if (inviteToken && inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
              <Building2 className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-base">Convite Inválido</CardTitle>
            <CardDescription className="text-[13px]">{inviteError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground">
            <Building2 className="h-6 w-6 text-background" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">SalesCRM</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Gerencie seu funil de vendas
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {inviteData ? "Aceitar Convite" : isLogin ? "Entrar" : "Criar conta"}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {inviteData
                ? "Complete seu cadastro para acessar o CRM"
                : isLogin
                  ? "Entre com suas credenciais"
                  : "Crie sua empresa e comece a vender"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Invite info banner */}
            {inviteData && (
              <div className="mb-4 rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium">{inviteData.tenant_name}</span>
                </div>
                {inviteData.tenant_cnpj && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CNPJ</span>
                    <span className="font-medium">{inviteData.tenant_cnpj}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cargo</span>
                  <Badge variant="secondary">{roleLabel(inviteData.role)}</Badge>
                </div>
                {inviteData.team_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{inviteData.team_name}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {!isLogin && !inviteData && (
                <>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome da empresa"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </>
              )}
              {inviteData && (
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  readOnly={!!inviteData}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Carregando..." : inviteData ? "Criar conta e aceitar" : isLogin ? "Entrar" : "Criar conta"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            {!inviteData && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[13px] text-primary transition-apple hover:underline"
                >
                  {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
