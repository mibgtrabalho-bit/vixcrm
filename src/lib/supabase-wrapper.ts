import { createClient, SupabaseClient } from '@supabase/supabase-js';

// External Supabase credentials
const EXTERNAL_SUPABASE_URL = 'https://yaspxmpgqxijfwgahryy.supabase.co';
const EXTERNAL_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhc3B4bXBncXhpamZ3Z2Ficnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjQxMzIsImV4cCI6MjA4ODYwMDEzMn0.08Ri69sSCaM574Wl32YvxQR80L9SYwEFhWBEvtaWSiY';

// Table name mapping: English -> Portuguese
const TABLE_MAP: Record<string, string> = {
  tenants: 'inquilinos',
  profiles: 'perfis',
  user_roles: 'funcoes_de_usuario',
  teams: 'equipes',
  team_members: 'membros_da_equipe',
  contacts: 'contatos',
  companies: 'empresas',
  funnels: 'funis',
  funnel_stages: 'funil_estagios',
  opportunities: 'oportunidades',
  opportunity_stage_history: 'historico_de_estagios',
  tasks: 'tarefas',
  invitations: 'convites',
  monthly_targets: 'metas_mensais',
  team_targets: 'metas_de_equipe',
};

// Create the raw Supabase client
const rawClient = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Proxy to intercept .from() calls and translate table names
export const supabase: SupabaseClient = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (tableName: string) => target.from(TABLE_MAP[tableName] || tableName);
    }
    return Reflect.get(target, prop, receiver);
  }
}) as SupabaseClient;
