-- Horaires de parution hebdomadaires pour le calendrier
-- day_of_week : 0 = Lundi ... 6 = Dimanche (semaine commençant le lundi)
CREATE TABLE public.release_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_id uuid REFERENCES public.titles(id) ON DELETE CASCADE,
  label text,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  release_time time NOT NULL DEFAULT '00:00',
  color text,
  manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_schedules TO authenticated;
GRANT ALL ON public.release_schedules TO service_role;
ALTER TABLE public.release_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own release_schedules all" ON public.release_schedules
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_release_schedules_user ON public.release_schedules(user_id);
CREATE INDEX idx_release_schedules_title ON public.release_schedules(title_id);

-- Realtime pour rafraîchir automatiquement le calendrier
ALTER PUBLICATION supabase_realtime ADD TABLE public.release_schedules;
