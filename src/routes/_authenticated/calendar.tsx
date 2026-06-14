import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

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

type TitleInfo = {
  num: number | null;       // dernier numéro de chapitre détecté
  chapterUrl: string | null; // lien vers ce chapitre
  sourceUrl: string | null;  // lien vers la page de la série (repli)
};

// ── Constantes ───────────────────────────────────────────────────────────────

// Nom de jour localisé (lundi = index 0). 2024-01-01 est un lundi.
function fmtDay(locale: string, mondayIdx: number, opt: "short" | "long"): string {
  const d = new Date(2024, 0, 1 + mondayIdx);
  const s = new Intl.DateTimeFormat(locale, { weekday: opt }).format(d).replace(/\.$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const EVENT_MIN_H = 36; // hauteur minimale d'un événement en px
const BLOCK_MIN = 55; // écart visuel (minutes) pour le calcul des collisions

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

// Construit le lien d'un chapitre cible en remplaçant le numéro dans l'URL du chapitre de base.
// Heuristique : les URLs de chapitres se terminent en général par le numéro (…/chapter-52).
function chapterUrlForNum(
  chapterUrl: string | null, baseNum: number | null, targetNum: number, sourceUrl: string | null,
): string | null {
  if (chapterUrl && baseNum != null) {
    if (targetNum === baseNum) return chapterUrl;
    const baseStr = String(baseNum);
    const idx = chapterUrl.lastIndexOf(baseStr);
    if (idx !== -1) {
      return chapterUrl.slice(0, idx) + String(targetNum) + chapterUrl.slice(idx + baseStr.length);
    }
  }
  return sourceUrl ?? chapterUrl ?? null;
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
  const { t, lang } = useI18n();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const dayShort = useMemo(() => Array.from({ length: 7 }, (_, i) => fmtDay(locale, i, "short")), [locale]);
  const dayFull = useMemo(() => Array.from({ length: 7 }, (_, i) => fmtDay(locale, i, "long")), [locale]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draft, setDraft] = useState<Draft | null>(null);

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

  // Pour chaque titre : dernier numéro de chapitre détecté + lien du chapitre + lien de la série.
  // Le numéro vient de title_sources.last_seen_chapter (fiable), le lien du chapitre correspondant.
  const { data: titleInfo = {} } = useQuery<Record<string, TitleInfo>>({
    queryKey: ["calendar-title-info"],
    queryFn: async () => {
      const MAX = 9999;
      const [{ data: srcs }, { data: chaps }] = await Promise.all([
        supabase.from("title_sources").select("title_id, url, last_seen_chapter"),
        supabase
          .from("chapters")
          .select("title_id, chapter_label, chapter_url, published_at")
          .order("published_at", { ascending: false, nullsFirst: false }),
      ]);

      const numByTitle: Record<string, number> = {};
      const srcUrlByTitle: Record<string, string> = {};
      for (const s of (srcs ?? []) as any[]) {
        const n = parseFloat(s.last_seen_chapter ?? "");
        if (!isNaN(n) && n <= MAX) {
          numByTitle[s.title_id] = Math.max(numByTitle[s.title_id] ?? -Infinity, n);
        }
        if (s.url && !srcUrlByTitle[s.title_id]) srcUrlByTitle[s.title_id] = s.url;
      }

      // URL du chapitre correspondant au numéro retenu (le plus récent en premier)
      const chapUrlByTitle: Record<string, string> = {};
      for (const c of (chaps ?? []) as any[]) {
        if (!c.chapter_url) continue;
        const target = numByTitle[c.title_id];
        if (target == null || chapUrlByTitle[c.title_id]) continue;
        if (parseFloat(c.chapter_label ?? "") === target) chapUrlByTitle[c.title_id] = c.chapter_url;
      }

      const map: Record<string, TitleInfo> = {};
      const ids = new Set([...Object.keys(numByTitle), ...Object.keys(srcUrlByTitle)]);
      for (const id of ids) {
        map[id] = {
          num: numByTitle[id] ?? null,
          chapterUrl: chapUrlByTitle[id] ?? null,
          sourceUrl: srcUrlByTitle[id] ?? null,
        };
      }
      return map;
    },
  });

  // Rafraîchissement automatique quand le scraping met à jour les horaires
  useEffect(() => {
    const channel = supabase
      .channel("rtk-calendar-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "release_schedules" }, () => {
        qc.invalidateQueries({ queryKey: ["release-schedules"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "title_sources" }, () => {
        qc.invalidateQueries({ queryKey: ["calendar-title-info"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () => {
        qc.invalidateQueries({ queryKey: ["calendar-title-info"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

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
      toast.error(t("cal.needTitle"));
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
        toast.success(t("cal.modified"));
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("release_schedules").insert({ ...payload, user_id: u.user!.id });
        if (error) throw error;
        toast.success(t("cal.added"));
      }
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["release-schedules"] });
    } catch (e: any) {
      toast.error(t("cal.saveFail"));
      console.error(e);
    }
  }

  async function deleteDraft() {
    if (!draft?.id) return;
    try {
      const { error } = await supabase.from("release_schedules").delete().eq("id", draft.id);
      if (error) throw error;
      toast.success(t("cal.deleted"));
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["release-schedules"] });
    } catch (e) {
      toast.error(t("cal.deleteFail"));
    }
  }

  const monthLabel = weekStart.toLocaleDateString(locale, { month: "long", year: "numeric" });

  return (
    <div className="flex h-screen flex-col p-6">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("cal.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("cal.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
          >
            {t("cal.today")}
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
            title={t("cal.prevWeek")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
            title={t("cal.nextWeek")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Grille (24h visibles, sans défilement) ── */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40">
        {/* En-tête des jours */}
        <div className="flex shrink-0 border-b border-border/60">
          <div className="w-14 shrink-0" />
          {dayShort.map((name, d) => {
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

        {/* Corps : remplit la hauteur restante, chaque heure = 1/24 de l'espace */}
        <div className="flex min-h-0 flex-1">
          {/* Colonne des heures */}
          <div className="flex w-14 shrink-0 flex-col">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative flex-1 border-b border-border/20">
                {h > 0 && (
                  <span className="absolute -top-2 right-1.5 text-[10px] text-muted-foreground">
                    {String(h).padStart(2, "0")}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Colonnes des jours */}
          {dayShort.map((_, d) => (
            <div key={d} className="relative flex flex-1 flex-col border-l border-border/40">
              {/* Cellules horaires cliquables (1/24 chacune) */}
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  onClick={() => openAdd(d, h)}
                  className="flex-1 cursor-pointer border-b border-border/20 transition hover:bg-accent/5"
                />
              ))}

              {/* Ligne "maintenant" */}
              {d === todayIdx && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                  style={{ top: `${(nowMin / 1440) * 100}%` }}
                >
                  <div className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
                  <div className="h-px flex-1 bg-red-500" />
                </div>
              )}

              {/* Événements (positionnés en % de la journée) */}
              {byDay[d].map((e) => {
                const widthPct = 100 / e.lanes;
                const leftPct = e.lane * widthPct;
                const name = e.label || e.titles?.name || t("cal.untitled");
                const color = e.color || colorFor(e.title_id || e.label || e.id);
                // Date/heure réelle de cette occurrence → passé ou futur
                const [hH, mM] = e.release_time.split(":").map((x) => parseInt(x, 10) || 0);
                const occBase = addDays(weekStart, d);
                const occDateTime = new Date(occBase.getFullYear(), occBase.getMonth(), occBase.getDate(), hH, mM, 0, 0);
                const isFuture = occDateTime.getTime() > now.getTime();

                const info = e.title_id ? titleInfo[e.title_id] : undefined;
                const baseNum = info?.num ?? null;

                // Numéro incrémenté selon la semaine : +1 par semaine après la dernière parution.
                let chapNum: number | null = null;
                let link: string | null = info?.chapterUrl ?? info?.sourceUrl ?? null;
                if (baseNum != null) {
                  // Référence = dernière occurrence de ce créneau déjà passée (= dernier chapitre détecté)
                  const curWeek = startOfWeek(now);
                  let ref = addDays(curWeek, e.day_of_week);
                  ref = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), hH, mM, 0, 0);
                  if (ref.getTime() > now.getTime()) ref = addDays(ref, -7);
                  const weeksDiff = Math.round((occDateTime.getTime() - ref.getTime()) / (7 * 86400000));
                  const n = baseNum + weeksDiff;
                  if (n >= 1) {
                    chapNum = n;
                    link = chapterUrlForNum(info?.chapterUrl ?? null, baseNum, n, info?.sourceUrl ?? null);
                  } else {
                    link = info?.sourceUrl ?? info?.chapterUrl ?? null;
                  }
                }
                const sub = chapNum != null ? `Ch. ${chapNum} · ${hhmm(e.release_time)}` : hhmm(e.release_time);
                // Futur = grisé + non cliquable (sauf la roue dentelée) ; passé = cliquable vers le site
                const bodyClickable = !isFuture && !!link;
                const Body = (
                  <>
                    <div className="truncate pr-4 text-[11px] font-semibold leading-tight text-foreground">{name}</div>
                    <div className="truncate text-[10px] leading-tight text-muted-foreground">{sub}</div>
                  </>
                );
                return (
                  <div
                    key={e.id}
                    className="group absolute z-20 overflow-hidden rounded-md border transition hover:brightness-110"
                    style={{
                      top: `${(e.min / 1440) * 100}%`,
                      height: EVENT_MIN_H,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      background: `${color}22`,
                      borderColor: `${color}66`,
                      borderLeft: `3px solid ${color}`,
                      opacity: isFuture ? 0.5 : 1,
                    }}
                  >
                    {/* Corps : ouvre le chapitre sur le site externe (parutions passées uniquement) */}
                    {bodyClickable ? (
                      <a
                        href={link!}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="flex h-full flex-col justify-center px-1.5 no-underline"
                        title={t("cal.openOnSite", { name, chap: chapNum != null ? t("cal.chapterOf", { n: chapNum }) : "" })}
                      >
                        {Body}
                      </a>
                    ) : (
                      <div
                        className="flex h-full cursor-default flex-col justify-center px-1.5"
                        title={isFuture ? t("cal.upcoming", { name }) : `${name} — ${hhmm(e.release_time)}`}
                      >
                        {Body}
                      </div>
                    )}

                    {/* Roue dentelée : modifier l'entrée */}
                    <button
                      onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); openEdit(e); }}
                      className="absolute right-0.5 top-0.5 z-30 rounded p-0.5 text-muted-foreground opacity-60 transition hover:bg-background/70 hover:text-foreground group-hover:opacity-100"
                      title={t("cal.editEntry")}
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Dialogue ajout / édition ── */}
      {draft && (
        <ScheduleDialog
          draft={draft}
          titles={titles}
          dayFull={dayFull}
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
  draft, titles, dayFull, onChange, onSave, onDelete, onClose,
}: {
  draft: Draft;
  titles: { id: string; name: string }[];
  dayFull: string[];
  onChange: (d: Draft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const isCustom = !draft.title_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{draft.id ? t("cal.editEntryTitle") : t("cal.addEntry")}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Titre */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("cal.titleField")}</label>
            <select
              value={draft.title_id}
              onChange={(e) => onChange({ ...draft, title_id: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {titles.map((ti) => (
                <option key={ti.id} value={ti.id}>{ti.name}</option>
              ))}
              <option value="">{t("cal.customName")}</option>
            </select>
          </div>

          {/* Nom personnalisé */}
          {isCustom && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("cal.name")}</label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) => onChange({ ...draft, label: e.target.value })}
                placeholder={t("cal.namePh")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                autoFocus
              />
            </div>
          )}

          {/* Jour + heure */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("cal.day")}</label>
              <select
                value={draft.day_of_week}
                onChange={(e) => onChange({ ...draft, day_of_week: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {dayFull.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("cal.time")}</label>
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
              <Trash2 className="h-4 w-4" /> {t("common.delete")}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted-foreground transition hover:bg-secondary/40">
              {t("common.cancel")}
            </button>
            <button
              onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}
            >
              {draft.id ? null : <Plus className="h-4 w-4" />}
              {saving ? "..." : draft.id ? t("common.save") : t("cal.addBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
