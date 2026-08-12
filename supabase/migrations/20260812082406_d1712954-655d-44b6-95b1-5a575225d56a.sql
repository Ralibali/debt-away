ALTER TABLE public.budgets DROP COLUMN IF EXISTS phase;

CREATE TABLE public.phase_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('barnvecka','ensamvecka')),
  planned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, phase)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_budgets TO authenticated;
GRANT ALL ON public.phase_budgets TO service_role;
ALTER TABLE public.phase_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phase_budgets" ON public.phase_budgets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_phase_budgets BEFORE UPDATE ON public.phase_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();