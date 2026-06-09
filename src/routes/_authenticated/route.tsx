import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Globe, Bell, Settings, LogOut, Upload, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-sidebar p-4 md:flex md:flex-col">
        <Link to="/dashboard" className="mb-6 px-2">
          <img src="/Logo RTK.png" alt="ReadingTK" className="h-9 w-auto" />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((it) => {
            const active = location.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to} to={it.to}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${active ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
              >
                <span className="flex items-center gap-2">
                  <it.icon className="h-4 w-4" /> {it.label}
                </span>
                {"badge" in it && it.badge ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{it.badge}</span>
                ) : null}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-border/40 pt-2">
            <Link to="/titles/add" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <Plus className="h-4 w-4" /> Ajouter un titre
            </Link>
            <Link to="/import" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <Upload className="h-4 w-4" /> Importer bookmarks
            </Link>
          </div>
        </nav>
        <button onClick={signOut} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
