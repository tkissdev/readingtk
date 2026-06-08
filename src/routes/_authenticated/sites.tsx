import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sites")({
  head: () => ({ meta: [{ title: "Sites · ReadingTK" }] }),
  component: SitesPage,
});

function SitesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [priority, setPriority] = useState(0);

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await supabase.from("sites").select("*").order("priority", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("sites").insert({
        user_id: u.user!.id, name, base_url: baseUrl, priority, enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site créé");
      setName(""); setBaseUrl(""); setPriority(0);
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; priority?: number; enabled?: boolean }) => {
      const { error } = await supabase.from("sites").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Sites à scraper</h1>
      <p className="mt-1 text-sm text-muted-foreground">La priorité la plus haute est scrappée en premier.</p>

      <div className="mt-6 grid gap-2 rounded-xl border border-border/60 bg-card/40 p-4 md:grid-cols-4">
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm" />
        <input placeholder="https://site.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm md:col-span-2" />
        <input type="number" placeholder="Priorité" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm" />
        <button onClick={() => create.mutate()} disabled={!name || !baseUrl}
          className="md:col-span-4 inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}>
          <Plus className="h-4 w-4" /> Ajouter le site
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-3 py-3 text-left">URL de base</th>
              <th className="px-3 py-3 text-left">Priorité</th>
              <th className="px-3 py-3 text-left">Activé</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(sites ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border/40">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-3 py-3 truncate text-xs text-muted-foreground">{s.base_url}</td>
                <td className="px-3 py-3">
                  <input type="number" defaultValue={s.priority}
                    onBlur={(e) => update.mutate({ id: s.id, priority: parseInt(e.target.value) || 0 })}
                    className="w-20 rounded-md border border-input bg-input/50 px-2 py-1 text-xs" />
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => update.mutate({ id: s.id, enabled: !s.enabled })}
                    className={`h-5 w-10 rounded-full transition ${s.enabled ? "bg-accent" : "bg-secondary"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-background transition ${s.enabled ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => del.mutate(s.id)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {(sites ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun site configuré.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
