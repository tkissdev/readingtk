import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, CalendarDays, Globe, Bell, Settings, Upload, Download, Plus } from "lucide-react";
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

const BLEND: React.CSSProperties = { mixBlendMode: "lighten", clipPath: "inset(3px 3px 3px 3px)" };

function AuthedLayout() {
  const router     = useRouter();
  const queryClient = useQueryClient();
  const location   = useLocation();
  const { user }   = Route.useRouteContext();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true"
  );
  const [showPopup, setShowPopup] = useState(false);

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

  function toggle() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  async function signOut() {
    setShowPopup(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    router.navigate({ to: "/auth", replace: true });
  }

  const navItems = [
    { to: "/dashboard",     label: "Bibliothèque", icon: LayoutGrid },
    { to: "/calendar",      label: "Calendrier",    icon: CalendarDays },
    { to: "/sites",         label: "Sites",         icon: Globe },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { to: "/settings",      label: "Paramètres",    icon: Settings },
  ] as const;

  const extraItems = [
    { to: "/titles/add", label: "Ajouter un titre",    icon: Plus },
    { to: "/import",     label: "Importer bookmarks",  icon: Upload },
    { to: "/export",     label: "Exporter bookmarks",  icon: Download },
  ] as const;

  const avatarLetter = (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">

      {/* ── Sidebar ── */}
      <aside
        className="hidden shrink-0 border-r border-border bg-sidebar py-4 md:flex md:flex-col"
        style={{ width: collapsed ? 52 : 200, transition: "width 0.2s ease", overflow: "visible" }}
      >

        {/* Logo zone */}
        <div
          className="mb-2 flex shrink-0 items-center border-b border-border pb-4"
          style={{
            padding: collapsed ? "12px 0 16px" : "0 12px 16px",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          <Link to="/dashboard" style={{ display: collapsed ? "none" : undefined }}>
            <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 130, height: "auto", ...BLEND }} />
          </Link>
          {collapsed && (
            <img src="/very small logo.png" alt="RTK" style={{ width: 28, height: "auto", ...BLEND }} />
          )}
          <button
            onClick={toggle}
            title={collapsed ? "Agrandir" : "Réduire"}
            className="shrink-0 rounded px-1.5 py-1 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {navItems.map((it) => {
            const active = location.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                title={collapsed ? it.label : undefined}
                className="flex items-center overflow-hidden whitespace-nowrap rounded text-[13px] font-medium no-underline transition-colors"
                style={{
                  gap: 8,
                  padding: collapsed ? "8px 0" : "8px 10px",
                  justifyContent: collapsed ? "center" : undefined,
                  background: active ? "var(--color-primary-glow, oklch(0.55 0.18 268 / 0.18))" : undefined,
                  color: active ? "var(--color-accent, oklch(0.70 0.20 268))" : undefined,
                  border: active ? "1px solid rgba(28,52,133,0.4)" : "1px solid transparent",
                }}
              >
                <span className="relative shrink-0" style={{ width: 18, textAlign: "center" }}>
                  <it.icon style={{ width: 15, height: 15 }} />
                  {collapsed && "badge" in it && it.badge ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                      {it.badge}
                    </span>
                  ) : null}
                </span>
                {!collapsed && (
                  <span className="flex flex-1 items-center justify-between">
                    {it.label}
                    {"badge" in it && it.badge ? (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                        {it.badge}
                      </span>
                    ) : null}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Extra links */}
          <div className="mt-2 border-t border-border/40 pt-2">
            {extraItems.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                title={collapsed ? it.label : undefined}
                className="flex items-center overflow-hidden whitespace-nowrap rounded text-[13px] text-muted-foreground no-underline transition-colors hover:bg-sidebar-accent hover:text-foreground"
                style={{
                  gap: 8,
                  padding: collapsed ? "8px 0" : "8px 10px",
                  justifyContent: collapsed ? "center" : undefined,
                }}
              >
                <span className="shrink-0" style={{ width: 18, textAlign: "center" }}>
                  <it.icon style={{ width: 15, height: 15 }} />
                </span>
                {!collapsed && it.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom — user */}
        <div
          className="relative mt-auto border-t border-border"
          style={{
            padding: collapsed ? "12px 0 0" : "12px 16px 0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: collapsed ? "center" : undefined,
          }}
        >
          {/* Avatar row */}
          <div className="flex items-center gap-2">
            <div
              onClick={collapsed ? () => setShowPopup(p => !p) : undefined}
              title={collapsed ? user?.email : undefined}
              className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${collapsed ? "cursor-pointer hover:opacity-80" : ""}`}
              style={{ width: 26, height: 26, background: "var(--gradient-primary)" }}
            >
              {avatarLetter}
            </div>
            {!collapsed && (
              <span className="truncate text-[11px] text-muted-foreground">{user?.email}</span>
            )}
          </div>

          {/* Logout button (expanded only) */}
          {!collapsed && (
            <button
              onClick={signOut}
              className="w-full rounded border border-border px-2 py-1 text-left text-[11px] text-muted-foreground transition hover:border-destructive hover:text-destructive"
            >
              Déconnexion
            </button>
          )}

          {/* Popup (collapsed) */}
          {collapsed && showPopup && (
            <div
              className="flex flex-col gap-1.5 rounded border border-border bg-card p-2 shadow-xl"
              style={{ position: "fixed", left: 60, bottom: 16, minWidth: 160, zIndex: 1000 }}
            >
              <div className="truncate px-1 text-[11px] text-muted-foreground">{user?.email}</div>
              <button
                onClick={signOut}
                className="rounded border border-border px-2 py-1 text-left text-[11px] text-muted-foreground transition hover:border-destructive hover:text-destructive"
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
