import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

interface PipelineTeamFilterProps {
  value: string; // "all" or team id
  onChange: (value: string) => void;
}

export function PipelineTeamFilter({ value, onChange }: PipelineTeamFilterProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { role, user } = useAuth();

  useEffect(() => {
    fetchTeams();
  }, [role, user?.id]);

  const fetchTeams = async () => {
    if (!user?.id) return;

    if (role === "diretor") {
      // Director sees all teams
      const { data } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      setTeams(data || []);
    } else if (role === "gestor") {
      // Manager sees only their teams
      const { data } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("user_id", user.id);

      const managerTeams: Team[] = (data || [])
        .map((tm: any) => tm.teams)
        .filter(Boolean);
      setTeams(managerTeams);

      // Auto-select if only one team
      if (managerTeams.length === 1) {
        onChange(managerTeams[0].id);
      }
    }
    setLoading(false);
  };

  // Seller: no filter shown
  if (role === "vendedor") return null;

  // Manager with single team: no selector needed (auto-filtered)
  if (role === "gestor" && teams.length <= 1) return null;

  if (loading) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9 text-sm">
        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Filtrar por time" />
      </SelectTrigger>
      <SelectContent>
        {role === "diretor" && (
          <SelectItem value="all">Todos os times</SelectItem>
        )}
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
