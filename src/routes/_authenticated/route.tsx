import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Globe, Bell, Settings, LogOut, Upload, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    router.navigate({ to: "/auth", replace: true });
  }

  const navItems = [
    { to: "/dashboard", label: "Bibliothèque", icon: LayoutGrid },
    { to: "/sites", label: "Sites", icon: Globe },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { to: "/settings", label: "Paramètres", icon: Settings },
  ] as const;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={`hidden shrink-0 border-r border-border/60 bg-sidebar p-4 md:flex md:flex-col transition-all duration-200 ${collapsed ? "w-16 items-center" : "w-60"}`}
      >
        {/* Logo + toggle */}
        <div className={`mb-6 flex items-center ${collapsed ? "justify-center w-full" : "justify-between px-2"}`}>
          {collapsed ? (
            <Link to="/dashboard">
              <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 28, height: "auto", mixBlendMode: "lighten" }} />
            </Link>
          ) : (
            <Link to="/dashboard">
              <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 130, height: "auto", mixBlendMode: "lighten" }} />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            title={collapsed ? "Agrandir" : "Réduire"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? "items-center w-full" : ""}`}>
          {navItems.map((it) => {
            const active = location.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                title={collapsed ? it.label : undefined}
                className={`flex items-center rounded-md text-sm font-medium transition ${collapsed ? "justify-center p-2 w-full" : "justify-between px-3 py-2"} ${active ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
              >
                <span className={`flex items-center ${collapsed ? "" : "gap-2"} relative`}>
                  <it.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && it.label}
                  {collapsed && "badge" in it && it.badge ? (
                    <span className="absolute -top-1 -right-1 rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-foreground">{it.badge}</span>
                  ) : null}
                </span>
                {!collapsed && "badge" in it && it.badge ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{it.badge}</span>
                ) : null}
              </Link>
            );
          })}

          {/* Extra links */}
          <div className={`mt-2 border-t border-border/40 pt-2 ${collapsed ? "flex flex-col items-center w-full gap-1" : ""}`}>
            <Link
              to="/titles/add"
              title={collapsed ? "Ajouter un titre" : undefined}
              className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${collapsed ? "justify-center p-2 w-full" : "gap-2 px-3 py-2"}`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && "Ajouter un titre"}
            </Link>
            <Link
              to="/import"
              title={collapsed ? "Importer bookmarks" : undefined}
              className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${collapsed ? "justify-center p-2 w-full" : "gap-2 px-3 py-2"}`}
            >
              <Upload className="h-4 w-4 shrink-0" />
              {!collapsed && "Importer bookmarks"}
            </Link>
          </div>
        </nav>

        {/* Sign out */}
        <button
          onClick={signOut}
          title={collapsed ? "Déconnexion" : undefined}
          className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${collapsed ? "justify-center p-2 w-full" : "gap-2 px-3 py-2"}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Déconnexion"}
        </button>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
