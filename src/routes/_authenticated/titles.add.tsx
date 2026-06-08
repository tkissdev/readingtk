import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/titles/add")({
  head: () => ({ meta: [{ title: "Ajouter des titres · ReadingTK" }] }),
  component: AddTitles,
});

function AddTitles() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"manual" | "urls">("manual");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("user_settings").select("default_type, default_status").maybeSingle();
      return data;
    },
  });

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await supabase.from("sites").select("*")).data ?? [],
  });

  async function submitManual() {
    setLoading(true);
    try {
      const names = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      const rows = names.map((name) => ({
        user_id: userId, name,
        type: settings?.default_type ?? "manga",
        status: settings?.default_status ?? "ongoing",
      }));
      const { error } = await supabase.from("titles").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} titre(s) créé(s)`);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  async function submitUrls() {
    setLoading(true);
    try {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;

      // create titles named from URL last segment, attach source
      for (const url of lines) {
        let name = url;
        try {
          const u = new URL(url);
          name = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? u.hostname).replace(/[-_]+/g, " ");
        } catch { /* keep url */ }
        const { data: title, error } = await supabase.from("titles").insert({
          user_id: userId, name,
          type: settings?.default_type ?? "manga",
          status: settings?.default_status ?? "ongoing",
        }).select("id").single();
        if (error) throw error;
        // match site by domain
        let siteId: string | null = null;
        try {
          const host = new URL(url).hostname;
          const match = (sites ?? []).find((s) => {
            try { return new URL(s.base_url).hostname === host; } catch { return false; }
          });
          siteId = match?.id ?? null;
        } catch { /* ignore */ }
        await supabase.from("title_sources").insert({ title_id: title.id, site_id: siteId, url, is_primary: true });
      }
      toast.success(`${lines.length} URL(s) importée(s)`);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Ajouter des titres</h1>
      <div className="mt-6 flex gap-2 border-b border-border/60">
        {(["manual", "urls"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-accent text-foreground" : "text-muted-foreground"}`}>
            {t === "manual" ? "Ajout manuel" : "Ajout via URLs"}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          {tab === "manual" ? "Un titre par ligne." : "Une URL par ligne. Le domaine sera associé automatiquement à un site existant."}
        </p>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={12}
          placeholder={tab === "manual" ? "One Piece\nSolo Leveling\n..." : "https://example.com/manga/one-piece\n..."}
          className="w-full rounded-md border border-input bg-input/50 p-3 font-mono text-sm outline-none focus:border-ring"
        />
        <button
          onClick={tab === "manual" ? submitManual : submitUrls}
          disabled={loading || !text.trim()}
          className="rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}
        >{loading ? "..." : "Créer"}</button>
      </div>
    </div>
  );
}
