-- 1. Vårdnadscykel
CREATE TABLE public.care_schedule (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  cycle_start date NOT NULL,
  cycle_days int NOT NULL DEFAULT 14,
  child_days int NOT NULL DEFAULT 7,
  handover_weekday int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_schedule TO authenticated;
GRANT ALL ON public.care_schedule TO service_role;
ALTER TABLE public.care_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own care_schedule" ON public.care_schedule FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Fas på transaktioner och budgetposter
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS phase text CHECK (phase IN ('barnvecka','ensamvecka')),
  ADD COLUMN IF NOT EXISTS phase_override boolean NOT NULL DEFAULT false;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS phase text CHECK (phase IN ('barnvecka','ensamvecka'));

-- 3. Buffertposter
CREATE TABLE public.sinking_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  annual_estimate numeric NOT NULL,
  current_balance numeric NOT NULL DEFAULT 0,
  monthly_accrual numeric GENERATED ALWAYS AS (annual_estimate / 12) STORED,
  next_expected date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinking_funds TO authenticated;
GRANT ALL ON public.sinking_funds TO service_role;
ALTER TABLE public.sinking_funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sinking_funds" ON public.sinking_funds FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Genomförandeintentioner
CREATE TABLE public.intentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trigger_text text NOT NULL,
  action_text text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('payday','date','phase_start','transaction')),
  trigger_config jsonb,
  active boolean NOT NULL DEFAULT true,
  fulfilled_count int NOT NULL DEFAULT 0,
  missed_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intentions TO authenticated;
GRANT ALL ON public.intentions TO service_role;
ALTER TABLE public.intentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intentions" ON public.intentions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.intention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  intention_id uuid NOT NULL REFERENCES public.intentions ON DELETE CASCADE,
  due_on date NOT NULL,
  fulfilled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intention_id, due_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intention_events TO authenticated;
GRANT ALL ON public.intention_events TO service_role;
ALTER TABLE public.intention_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intention_events" ON public.intention_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Veckoavstämning
CREATE TABLE public.weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  phase_start date NOT NULL,
  phase text NOT NULL CHECK (phase IN ('barnvecka','ensamvecka')),
  overspent_category_ids uuid[] NOT NULL DEFAULT '{}',
  planned_next jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phase_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reviews TO authenticated;
GRANT ALL ON public.weekly_reviews TO service_role;
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly_reviews" ON public.weekly_reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Aviseringar: högst en per dag
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sent_on date NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sent_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification_log" ON public.notification_log FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Nya parametrar
ALTER TABLE public.user_parameters
  ADD COLUMN IF NOT EXISTS child_allowance_total numeric NOT NULL DEFAULT 2650,
  ADD COLUMN IF NOT EXISTS child_allowance_share numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS child_allowance_day int NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS payday int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS notifications_paused_until date;

-- 8. updated_at-triggers
CREATE TRIGGER touch_care_schedule BEFORE UPDATE ON public.care_schedule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_sinking_funds BEFORE UPDATE ON public.sinking_funds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_intentions BEFORE UPDATE ON public.intentions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();