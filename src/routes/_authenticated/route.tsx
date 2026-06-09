import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Globe, Bell, Settings, Upload, Plus } from "lucide-react";
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

const LOGO_STYLE = { mixBlendMode: "lighten" as const, clipPath: "inset(3px 3px 3px 3px)" };

function AuthedLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = Route.useRouteContext();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true"
  );
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

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

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    router.navigate({ to: "/auth", replace: true });
  }

  const navItems = [
    { to: "/dashboard",     label: "Bibliothèque", icon: LayoutGrid },
    { to: "/sites",         label: "Sites",         icon: Globe },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { to: "/settings",      label: "Paramètres",    icon: Settings },
  ] as const;

  const avatarLetter = (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className={`hidden shrink-0 border-r border-border/60 bg-sidebar transition-all duration-200 md:flex md:flex-col ${collapsed ? "w-16 items-center p-2 pt-4" : "w-60 p-4"}`}>

        {/* Logo + toggle */}
        <div className={`mb-6 flex items-center ${collapsed ? "w-full flex-col gap-3" : "justify-between px-2"}`}>
          <Link to="/dashboard">
            {collapsed
              ? <img src="/very small logo.png" alt="ReadingTK" style={{ width: 32, height: "auto", ...LOGO_STYLE }} />
              : <img src="/Logo RTK.png"        alt="ReadingTK" style={{ width: 130, height: "auto", ...LOGO_STYLE }} />
            }
          </Link>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Agrandir" : "Réduire"}
            className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? "w-full items-center" : ""}`}>
          {navItems.map((it) => {
            const active = location.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                title={collapsed ? it.label : undefined}
                className={`flex items-center rounded-md text-sm font-medium transition
                  ${collapsed ? "w-full justify-center p-2" : "justify-between px-3 py-2"}
                  ${active ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
              >
                <span className={`relative flex items-center ${collapsed ? "" : "gap-2"}`}>
                  <it.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && it.label}
                  {collapsed && "badge" in it && it.badge ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-foreground">{it.badge}</span>
                  ) : null}
                </span>
                {!collapsed && "badge" in it && it.badge ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{it.badge}</span>
                ) : null}
              </Link>
            );
          })}

          {/* Extra links */}
          <div className={`mt-2 border-t border-border/40 pt-2 ${collapsed ? "flex w-full flex-col items-center gap-1" : ""}`}>
            <Link
              to="/titles/add"
              title={collapsed ? "Ajouter un titre" : undefined}
              className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${collapsed ? "w-full justify-center p-2" : "gap-2 px-3 py-2"}`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && "Ajouter un titre"}
            </Link>
            <Link
              to="/import"
              title={collapsed ? "Importer bookmarks" : undefined}
              className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${collapsed ? "w-full justify-center p-2" : "gap-2 px-3 py-2"}`}
            >
              <Upload className="h-4 w-4 shrink-0" />
              {!collapsed && "Importer bookmarks"}
            </Link>
          </div>
        </nav>

        {/* Bottom — user info */}
        <div className={`relative mt-2 border-t border-border/40 pt-3 ${collapsed ? "flex w-full flex-col items-center" : ""}`}>
          {/* Avatar */}
          <div
            onClick={collapsed ? () => setShowLogoutPopup(p => !p) : undefined}
            title={collapsed ? user?.email : undefined}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${collapsed ? "cursor-pointer" : ""}`}
            style={{ background: "var(--gradient-primary)" }}
          >
            {avatarLetter}
          </div>

          {/* Expanded: email + logout */}
          {!collapsed && (
            <div className="mt-2 flex flex-col gap-1 px-1">
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              <button
                onClick={signOut}
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
              >
                Déconnexion
              </button>
            </div>
          )}

          {/* Collapsed: popup */}
          {collapsed && showLogoutPopup && (
            <div className="absolute bottom-0 left-14 z-50 min-w-[180px] rounded-lg border border-border bg-card p-3 shadow-xl">
              <div className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</div>
              <button
                onClick={signOut}
                className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
