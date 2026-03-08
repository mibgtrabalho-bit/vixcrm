import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Building2,
  Target,
  BarChart3,
  Eye,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  children?: { icon: React.ElementType; label: string; href: string }[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Kanban, label: "Pipeline", href: "/pipeline" },
  { icon: Users, label: "Contatos", href: "/contacts" },
  { icon: Building2, label: "Empresas", href: "/companies" },
  {
    icon: Eye,
    label: "Visão Estratégica",
    children: [
      { icon: Target, label: "Metas", href: "/goals" },
      { icon: BarChart3, label: "Relatórios", href: "/reports" },
    ],
  },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  const isStrategicActive = ["/goals", "/reports"].includes(location.pathname);
  const [strategicOpen, setStrategicOpen] = useState(isStrategicActive);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-apple",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4">
        {!collapsed && (
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            SalesCRM
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 transition-apple hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {navItems.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some((c) => location.pathname === c.href);
            const isOpen = strategicOpen || isChildActive;

            // Collapsed mode: show only the parent icon, clicking navigates to first child
            if (collapsed) {
              return (
                <Link
                  key={item.label}
                  to={item.children[0].href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-apple",
                    isChildActive
                      ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              );
            }

            return (
              <div key={item.label} className="space-y-0.5">
                <button
                  onClick={() => setStrategicOpen(!isOpen)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-apple",
                    isChildActive
                      ? "text-sidebar-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="ml-3 space-y-0.5 border-l border-border/60 pl-3">
                    {item.children.map((child) => {
                      const active = location.pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-apple",
                            active
                              ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                        >
                          <child.icon className="h-4 w-4 shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href!}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-apple",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">{profile?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
