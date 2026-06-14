import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendrier · ReadingTK" }] }),
  component: CalendarPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Schedule = {
  id: string;
  title_id: string | null;
  label: string | null;
  day_of_week: number; // 0 = Lundi ... 6 = Dimanche
  release_time: string; // "HH:MM:SS"
  color: string | null;
  manual: boolean;
  titles: { name: string } | null;
};

type Draft = {
  id?: string;
  title_id: string;
  label: string;
  day_of_week: number;
  time: string; // "HH:MM"
};

// ── Constantes ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOUR_H = 48; // hauteur d'une heure en px
const DAY_H = 24 * HOUR_H;
const BLOCK_MIN = 50; // durée visuelle d'un événement (minutes) pour le calcul des collisions

const PALETTE = ["#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6"];
function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ── Helpers date ─────────────────────────────────────────────────────────────

// Lundi 00:00 (local) de la semaine contenant `d`
function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // 0 = Lundi
  r.setDate(r.getDate() - dow);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function timeToMin(t: string): number {
  const [h, m] = t.split(":");
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}
function hhmm(t: string): string {
  const [h, m] = t.split(":");
  return `${(h || "00").padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Répartit les événements d'une journée en colonnes pour éviter les chevauchements
type Laid = Schedule & { min: number; lane: number; lanes: number };
function layoutDay(events: (Schedule & { min: number })[]): Laid[] {
  const evs = [...events].sort((a, b) => a.min - b.min);
  const laneEnds: number[] = [];
  const withLane = evs.map((e) => {
    let lane = laneEnds.findIndex((end) => end <= e.min);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = e.min + BLOCK_MIN;
    return { e, lane };
  });
  const out: Laid[] = [];
  let i = 0;
  while (i < withLane.length) {
    let j = i;
    let clusterEnd = withLane[i].e.min + BLOCK_MIN;
    let maxLane = withLane[i].lane;
    while (j + 1 < withLane.length && withLane[j + 1].e.min < clusterEnd) {
      j++;
      clusterEnd = Math.max(clusterEnd, withLane[j].e.min + BLOCK_MIN);
      maxLane = Math.max(maxLane, withLane[j].lane);
    }
    for (let k = i; k <= j; k++) {
      out.push({ ...withLane[k].e, lane: withLane[k].lane, lanes: maxLane + 1 });
    }
    i = j + 1;
  }
  return out;
}

// ── Page ─────────────────────────────────────────────────────────────────────

function CalendarPage() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["release-schedules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("release_schedules")
        .select("id, title_id, label, day_of_week, release_time, color, manual, titles(name)")
        .order("release_time");
      return (data ?? []) as Schedule[];
    },
  });

  const { data: titles = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["titles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("titles").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Rafraîchissement automatique quand le scraping met à jour les horaires
  useEffect(() => {
    const channel = supabase
      .channel("rtk-calendar-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "release_schedules" }, () => {
        qc.invalidateQueries({ queryKey: ["release-schedules"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Position de défilement initiale : vers 7h
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H;
  }, []);

  // Événements répartis par jour avec gestion des chevauchements
  const byDay = useMemo(() => {
    const days: Laid[][] = [[], [], [], [], [], [], []];
    const grouped: (Schedule & { min: number })[][] = [[], [], [], [], [], [], []];
    for (const s of schedules) {
      const d = ((s.day_of_week % 7) + 7) % 7;
      grouped[d].push({ ...s, min: timeToMin(s.release_time) });
    }
    for (let d = 0; d < 7; d++) days[d] = layoutDay(grouped[d]);
    return days;
  }, [schedules]);

  const now = new Date();
  const todayIdx = (() => {
    for (let d = 0; d < 7; d++) if (sameDay(addDays(weekStart, d), now)) return d;
    return -1;
  })();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  function openAdd(day: number, hour: number) {
    setDraft({
      title_id: titles[0]?.id ?? "",
      label: "",
      day_of_week: day,
      time: `${String(hour).padStart(2, "0")}:00`,
    });
  }
  function openEdit(s: Schedule) {
    setDraft({
      id: s.id,
      title_id: s.title_id ?? "",
      label: s.label ?? "",
      day_of_week: s.day_of_week,
      time: hhmm(s.release_time),
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const isCustom = !draft.title_id;
    if (isCustom && !draft.label.trim()) {
      toast.error("Choisissez un titre ou saisissez un nom");
      return;
    }
    const payload = {
      title_id: draft.title_id || null,
      label: isCustom ? draft.label.trim() : null,
      day_of_week: draft.day_of_week,
      release_time: draft.time.length === 5 ? `${draft.time}:00` : draft.time,
      manual: true,
    };
    try {
      if (draft.id) {
        const { error } = await supabase.from("release_schedules").update(payload).eq("id", draft.id);
        if (error) throw error;
        toast.success("Entrée modifiée");
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("release_schedules").insert({ ...payload, user_id: u.user!.id });
        if (error) throw error;
        toast.success("Entrée ajoutée");
      }
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["release-schedules"] });
    } catch (e: any) {
      toast.error("Échec de l'enregistrement");
      console.error(e);
    }
  }

  async function deleteDraft() {
    if (!draft?.id) return;
    try {
      const { error } = await supabase.from("release_schedules").delete().eq("id", draft.id);
      if (error) throw error;
      toast.success("Entrée supprimée");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["release-schedules"] });
    } catch (e) {
      toast.error("Échec de la suppression");
    }
  }

  const monthLabel = weekStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="flex h-screen flex-col p-6">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendrier</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jour et heure de parution de chaque titre, chaque semaine. Cliquez pour ajouter ou modifier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
            title="Semaine précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
            title="Semaine suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Grille ── */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40">
        {/* En-tête des jours */}
        <div className="flex shrink-0 border-b border-border/60 pr-[10px]">
          <div className="w-14 shrink-0" />
          {DAY_NAMES.map((name, d) => {
            const date = addDays(weekStart, d);
            const isToday = d === todayIdx;
            return (
              <div key={d} className="flex-1 border-l border-border/40 py-2 text-center">
                <div className="text-[11px] uppercase text-muted-foreground">{name}</div>
                <div
                  className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday ? "bg-accent text-accent-foreground" : "text-foreground"
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Zone scrollable */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex" style={{ height: DAY_H }}>
            {/* Colonne des heures */}
            <div className="w-14 shrink-0">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="relative border-b border-border/20" style={{ height: HOUR_H }}>
                  {h > 0 && (
                    <span className="absolute -top-2 right-1.5 text-[10px] text-muted-foreground">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Colonnes des jours */}
            {DAY_NAMES.map((_, d) => (
              <div key={d} className="relative flex-1 border-l border-border/40">
                {/* Cellules horaires cliquables */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    onClick={() => openAdd(d, h)}
                    className="cursor-pointer border-b border-border/20 transition hover:bg-accent/5"
                    style={{ height: HOUR_H }}
                  />
                ))}

                {/* Ligne "maintenant" */}
                {d === todayIdx && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: (nowMin / 60) * HOUR_H }}
                  >
                    <div className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
                    <div className="h-px flex-1 bg-red-500" />
                  </div>
                )}

                {/* Événements */}
                {byDay[d].map((e) => {
                  const top = (e.min / 60) * HOUR_H;
                  const widthPct = 100 / e.lanes;
                  const leftPct = e.lane * widthPct;
                  const name = e.label || e.titles?.name || "Sans titre";
                  const color = e.color || colorFor(e.title_id || e.label || e.id);
                  const occurAt = addDays(weekStart, d);
                  const isPast =
                    occurAt < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ||
                    (d === todayIdx && e.min < nowMin);
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                      className="absolute z-20 overflow-hidden rounded-md border px-1.5 py-1 text-left transition hover:brightness-110"
                      style={{
                        top,
                        height: Math.max((BLOCK_MIN / 60) * HOUR_H, 34),
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        background: `${color}22`,
                        borderColor: `${color}66`,
                        borderLeft: `3px solid ${color}`,
                        opacity: isPast ? 0.45 : 1,
                      }}
                      title={`${name} — ${hhmm(e.release_time)}`}
                    >
                      <div className="truncate text-[11px] font-semibold leading-tight text-foreground">{name}</div>
                      <div className="text-[10px] leading-tight text-muted-foreground">{hhmm(e.release_time)}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dialogue ajout / édition ── */}
      {draft && (
        <ScheduleDialog
          draft={draft}
          titles={titles}
          onChange={setDraft}
          onSave={saveDraft}
          onDelete={draft.id ? deleteDraft : undefined}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}

// ── Dialogue ─────────────────────────────────────────────────────────────────

function ScheduleDialog({
  draft, titles, onChange, onSave, onDelete, onClose,
}: {
  draft: Draft;
  titles: { id: string; name: string }[];
  onChange: (d: Draft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const isCustom = !draft.title_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{draft.id ? "Modifier l'entrée" : "Ajouter une entrée"}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Titre */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Titre</label>
            <select
              value={draft.title_id}
              onChange={(e) => onChange({ ...draft, title_id: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {titles.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              <option value="">— Nom personnalisé —</option>
            </select>
          </div>

          {/* Nom personnalisé */}
          {isCustom && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nom</label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) => onChange({ ...draft, label: e.target.value })}
                placeholder="Ex. Nouvelle parution"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                autoFocus
              />
            </div>
          )}

          {/* Jour + heure */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Jour</label>
              <select
                value={draft.day_of_week}
                onChange={(e) => onChange({ ...draft, day_of_week: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {DAY_FULL.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Heure</label>
              <input
                type="time"
                value={draft.time}
                onChange={(e) => onChange({ ...draft, time: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {onDelete ? (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted-foreground transition hover:bg-secondary/40">
              Annuler
            </button>
            <button
              onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}
            >
              {draft.id ? null : <Plus className="h-4 w-4" />}
              {saving ? "..." : draft.id ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
