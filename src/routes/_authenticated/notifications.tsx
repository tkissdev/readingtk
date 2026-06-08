import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · ReadingTK" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string; read_at: string | null; created_at: string;
  titles: { name: string } | null;
  chapters: { chapter_label: string; chapter_url: string } | null;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, read_at, created_at, titles(name), chapters(chapter_label, chapter_url)")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data as unknown as Notif[]) ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (id) q = q.eq("id", id);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={() => { markRead.mutate(undefined); toast.success("Tout marqué lu"); }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent/10">Tout marquer comme lu</button>
      </div>

      <ul className="mt-6 space-y-2">
        {(data ?? []).map((n) => (
          <li key={n.id} className={`flex items-center justify-between rounded-xl border border-border/60 p-4 ${n.read_at ? "bg-card/30 opacity-60" : "bg-card/60"}`}>
            <div>
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-3.5 w-3.5 text-accent" />
                <span className="font-medium">{n.titles?.name ?? "Titre supprimé"}</span>
                <span className="text-muted-foreground">— {n.chapters?.chapter_label}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2">
              {n.chapters?.chapter_url && (
                <a href={n.chapters.chapter_url} target="_blank" rel="noopener noreferrer"
                  className="rounded-md bg-secondary/60 px-3 py-1.5 text-xs hover:bg-secondary">Ouvrir</a>
              )}
              {!n.read_at && (
                <button onClick={() => markRead.mutate(n.id)} className="rounded-md p-1.5 hover:bg-accent/10" title="Marquer comme lu">
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
        {(data ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Aucune notification pour l'instant.
          </li>
        )}
      </ul>
    </div>
  );
}
