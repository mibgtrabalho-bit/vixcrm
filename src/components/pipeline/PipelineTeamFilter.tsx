import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Users, ChevronDown, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamWithMembers {
  id: string;
  name: string;
  members: { user_id: string; full_name: string }[];
}

// Filter value format:
// "all"          → all opportunities (director only)
// "team:<id>"    → all opportunities for a team
// "user:<id>"    → opportunities for a specific user
export interface PipelineFilterValue {
  raw: string;
  type: "all" | "team" | "user";
  id?: string;
}

export function parsePipelineFilter(value: string): PipelineFilterValue {
  if (value === "all") return { raw: value, type: "all" };
  if (value.startsWith("team:")) return { raw: value, type: "team", id: value.slice(5) };
  if (value.startsWith("user:")) return { raw: value, type: "user", id: value.slice(5) };
  // Legacy: bare UUID = team
  return { raw: value, type: "team", id: value };
}

interface PipelineTeamFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function PipelineTeamFilter({ value, onChange }: PipelineTeamFilterProps) {
  const [teamsWithMembers, setTeamsWithMembers] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { role, user } = useAuth();

  useEffect(() => {
    if (user?.id && role) fetchData();
  }, [role, user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;

    let teamIds: string[] = [];

    if (role === "diretor") {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      teamIds = (teams || []).map((t) => t.id);

      // Fetch members and profiles separately to avoid FK join issues
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      const memberUserIds = [...new Set((members || []).map((m: any) => m.user_id))];

      const { data: profiles } = memberUserIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", memberUserIds).eq("is_active", true)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      const teamsMap: TeamWithMembers[] = (teams || []).map((t) => ({
        id: t.id,
        name: t.name,
        members: (members || [])
          .filter((m: any) => m.team_id === t.id && profileMap.has(m.user_id))
          .map((m: any) => ({
            user_id: m.user_id,
            full_name: profileMap.get(m.user_id) || "Sem nome",
          }))
          .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)),
      }));

      setTeamsWithMembers(teamsMap);
    } else if (role === "gestor") {
      // Manager: only their teams
      const { data: myTeams } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("user_id", user.id);

      const teams = (myTeams || []).map((t: any) => t.teams).filter(Boolean);
      teamIds = teams.map((t: any) => t.id);

      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      const memberUserIds = [...new Set((members || []).map((m: any) => m.user_id))];

      const { data: profiles } = memberUserIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", memberUserIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      const teamsMap: TeamWithMembers[] = teams.map((t: any) => ({
        id: t.id,
        name: t.name,
        members: (members || [])
          .filter((m: any) => m.team_id === t.id && profileMap.has(m.user_id))
          .map((m: any) => ({
            user_id: m.user_id,
            full_name: profileMap.get(m.user_id) || "Sem nome",
          }))
          .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)),
      }));

      setTeamsWithMembers(teamsMap);

      // Auto-select single team
      if (teamsMap.length === 1 && value === "all") {
        onChange(`team:${teamsMap[0].id}`);
      }
    }

    setLoading(false);
  };

  // Compute display label
  const displayLabel = useMemo(() => {
    const parsed = parsePipelineFilter(value);
    if (parsed.type === "all") return "Todos os times";
    if (parsed.type === "team") {
      const team = teamsWithMembers.find((t) => t.id === parsed.id);
      return team?.name || "Time";
    }
    if (parsed.type === "user") {
      for (const team of teamsWithMembers) {
        const member = team.members.find((m) => m.user_id === parsed.id);
        if (member) return member.full_name;
      }
      return "Usuário";
    }
    return "Filtrar";
  }, [value, teamsWithMembers]);

  // Seller: no filter
  if (role === "vendedor") return null;

  // Manager with single team and single member (themselves): hide
  if (role === "gestor" && teamsWithMembers.length === 1 && teamsWithMembers[0].members.length <= 1) return null;

  if (loading) return null;

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setOpen(false);
  };

  const parsed = parsePipelineFilter(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-sm font-normal"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-1" align="start">
        <div className="max-h-[320px] overflow-y-auto">
          {/* All teams option (director only) */}
          {role === "diretor" && (
            <button
              onClick={() => handleSelect("all")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                parsed.type === "all" && "bg-accent"
              )}
            >
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 text-left">Todos os times</span>
              {parsed.type === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          )}

          {/* Teams with members */}
          {teamsWithMembers.map((team) => (
            <div key={team.id} className="mt-1">
              {/* Team header (clickable = select whole team) */}
              <button
                onClick={() => handleSelect(`team:${team.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent",
                  parsed.type === "team" && parsed.id === team.id && "bg-accent"
                )}
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 text-left">{team.name}</span>
                {parsed.type === "team" && parsed.id === team.id && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </button>

              {/* Team members */}
              {team.members.map((member) => (
                <button
                  key={member.user_id}
                  onClick={() => handleSelect(`user:${member.user_id}`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-7 text-sm hover:bg-accent",
                    parsed.type === "user" && parsed.id === member.user_id && "bg-accent"
                  )}
                >
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="flex-1 text-left">{member.full_name}</span>
                  {parsed.type === "user" && parsed.id === member.user_id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
