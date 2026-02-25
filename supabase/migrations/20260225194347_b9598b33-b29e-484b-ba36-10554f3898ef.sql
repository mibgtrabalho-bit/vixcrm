
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('vendedor', 'gestor', 'diretor');

-- Pipeline stages enum
CREATE TYPE public.pipeline_stage AS ENUM (
  'prospeccao', 'follow_up', 'agenda', 'proposta', 'negociacao', 'fechado', 'perdido'
);

-- Tenants (empresas)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT '1-10',
  max_users INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'vendedor',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Contacts (leads)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  custom_fields JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  address TEXT,
  website TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Opportunities
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage pipeline_stage NOT NULL DEFAULT 'prospeccao',
  value NUMERIC(15,2),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  expected_close_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies

-- Tenants
CREATE POLICY "Users can view own tenant" ON public.tenants
  FOR SELECT USING (id = public.get_user_tenant(auth.uid()));

-- Profiles
CREATE POLICY "Users can view tenant profiles" ON public.profiles
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- User roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Managers can view roles" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor')
  );

-- Teams
CREATE POLICY "Users can view tenant teams" ON public.teams
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "Managers can manage teams" ON public.teams
  FOR ALL USING (
    tenant_id = public.get_user_tenant(auth.uid()) AND
    (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor'))
  );

-- Team members
CREATE POLICY "Users can view team members" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE tenant_id = public.get_user_tenant(auth.uid()))
  );

-- Contacts
CREATE POLICY "Users can view tenant contacts" ON public.contacts
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "Users can create contacts" ON public.contacts
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Users can update tenant contacts" ON public.contacts
  FOR UPDATE USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Companies
CREATE POLICY "Users can view tenant companies" ON public.companies
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "Users can create companies" ON public.companies
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Users can update tenant companies" ON public.companies
  FOR UPDATE USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Opportunities
CREATE POLICY "Vendedor sees own opportunities" ON public.opportunities
  FOR SELECT USING (
    tenant_id = public.get_user_tenant(auth.uid()) AND
    (assigned_to = auth.uid() OR created_by = auth.uid())
  );
CREATE POLICY "Managers see team opportunities" ON public.opportunities
  FOR SELECT USING (
    tenant_id = public.get_user_tenant(auth.uid()) AND
    (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor'))
  );
CREATE POLICY "Users can create opportunities" ON public.opportunities
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid()) AND created_by = auth.uid()
  );
CREATE POLICY "Users can update own opportunities" ON public.opportunities
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant(auth.uid()) AND
    (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor'))
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    (NEW.raw_user_meta_data->>'tenant_id')::UUID
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'vendedor')
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
