import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Check, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · ReadingTK" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  read_at: string | null;
  created_at: string;
  titles: { name: string } | null;
  chapters: { chapter_label: string; chapter_url: string } | null;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, read_at, created_at, titles(name), chapters(chapter_label, chapter_url)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as Notif[]) ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      let q = supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (id) q = q.eq("id", id);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      toast.success(t("notif.allDeleted"));
      setConfirmDelete(false);
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("notif.title")}</h1>
        <div className="relative flex items-center gap-2">
          {/* Bouton tout supprimer */}
          <div className="relative">
            <button
              onClick={() => setConfirmDelete((p) => !p)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              {t("notif.deleteAll")}
            </button>
            {confirmDelete && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-card p-3 shadow-xl">
                <p className="mb-2 text-xs text-muted-foreground">{t("notif.deleteAllConfirm")}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteAll.mutate()}
                    disabled={deleteAll.isPending}
                    className="flex-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Bouton tout marquer comme lu */}
          <button
            onClick={() => {
              markRead.mutate(undefined);
              toast.success(t("notif.allMarked"));
            }}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent/10"
          >
            {t("notif.markAllRead")}
          </button>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {(data ?? []).map((n) => (
          <li
            key={n.id}
            className={`flex items-center justify-between rounded-xl border border-border/60 p-4 ${n.read_at ? "bg-card/30 opacity-60" : "bg-card/60"}`}
          >
            <div>
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-3.5 w-3.5 text-accent" />
                <span className="font-medium">{n.titles?.name ?? t("notif.titleDeleted")}</span>
                <span className="text-muted-foreground">— {n.chapters?.chapter_label}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString(locale)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {n.chapters?.chapter_url && (
                <a
                  href={n.chapters.chapter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-secondary/60 px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  {t("common.open")}
                </a>
              )}
              {!n.read_at && (
                <button
                  onClick={() => markRead.mutate(n.id)}
                  className="rounded-md p-1.5 hover:bg-accent/10"
                  title={t("notif.markRead")}
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
        {(data ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
            {t("notif.empty")}
          </li>
        )}
      </ul>
    </div>
  );
}
