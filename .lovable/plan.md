

# CRM de Vendas - Plano de Implementação

## Visão Geral
CRM multi-empresa com funis Kanban, gestão de times, dashboards de vendas e metas. Visual clean e minimalista, inspirado no Pipedrive. Backend com Supabase (a ser conectado).

---

## Fase 1 — Fundação (Auth + Estrutura + Kanban)

### 1.1 Autenticação e Estrutura Multi-empresa
- Login por e-mail/senha com Supabase Auth
- Cadastro de empresas (tenants) com planos por faixa de usuários (1-10, 11-20, etc.)
- Cada usuário vinculado a uma empresa
- 3 níveis de acesso: **Vendedor**, **Gestor**, **Diretor**
- Convite de novos usuários pelo Gestor/Diretor

### 1.2 Kanban de Oportunidades
- Board Kanban com as 7 colunas padrão: Prospecção → Follow-up → Agenda → Proposta → Negociação → Fechado → Perdido
- Drag & drop de cards entre colunas
- **Regra de negócio**: Coluna "Proposta" exige valor preenchido — bloqueio ao mover card sem valor
- Alternância de visualização: **Kanban ↔ Lista**
- Filtros por vendedor, data, valor

### 1.3 Visibilidade por Nível de Acesso
- **Vendedor**: vê apenas suas oportunidades e as atribuídas a ele
- **Gestor**: vê oportunidades do seu time, pode mover cards entre membros do time
- **Diretor**: vê tudo, move cards de qualquer usuário para qualquer outro

### 1.4 Cadastro de Leads/Empresas
- Formulário de **Contato**: Nome do decisor, e-mail, telefone + campos personalizáveis
- Formulário de **Empresa**: CNPJ (com auto-preenchimento via API da Receita Federal), endereço, site, valor da venda
- Contato obrigatório ao cadastrar empresa
- Vinculação Contato ↔ Empresa ↔ Oportunidade

---

## Fase 2 — Dashboards e Metas

### 2.1 Dashboards de Vendas
- 4 dashboards configuráveis:
  1. Vendas Previstas SaaS
  2. Vendas Previstas Implantação
  3. Vendas Realizadas SaaS
  4. Vendas Realizadas Implantação
- Opção de reduzir para 2 dashboards (para empresas com uma única linha de receita)
- Gráficos de barras, funil e evolução temporal
- Filtros por período, time e vendedor

### 2.2 Sistema de Metas
- Gestor/Diretor define metas individuais por vendedor (input manual)
- Vendedor visualiza: sua meta, vendas realizadas e vendas previstas
- Gestor vê metas e progresso do seu time
- Diretor vê metas e progresso de todos os times
- Barra de progresso visual da meta

---

## Fase 3 — Comunicação e Refinamentos

### 3.1 E-mail em Bloco
- Seleção múltipla de contatos na visualização em lista
- Botão "Enviar e-mail em bloco"
- Editor de e-mail com campo de personalização (ex: `{{nome_contato}}`)
- Envio via serviço de e-mail (Resend ou SendGrid — a definir)

### 3.2 Gestão de Times
- Criação de times (Time de Vendas A, B, Prospecção, etc.)
- Atribuição de usuários a times
- Gestor vinculado a um ou mais times

---

## Requisitos Técnicos (Backend)
- **Supabase** para autenticação, banco de dados e RLS (Row Level Security)
- Tabelas separadas para roles (segurança contra escalação de privilégios)
- RLS por empresa (tenant isolation) e por nível de acesso
- Edge Function para consulta de CNPJ na Receita Federal
- Edge Function para envio de e-mails em bloco

