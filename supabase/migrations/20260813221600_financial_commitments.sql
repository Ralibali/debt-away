-- Privata fasta åtaganden med metadata som budgeten saknar.
-- Belopp lagras per användare bakom RLS. Ingen personlig ekonomi seedas i Git.
CREATE TABLE public.financial_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories ON DELETE SET NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (
    kind IN ('housing','leasing','insurance','utilities','telecom','subscription','transport','other')
  ),
  monthly_amount numeric NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  payment_day int CHECK (payment_day BETWEEN 1 AND 31),
  starts_on date,
  ends_on date,
  notice_days int CHECK (notice_days IS NULL OR notice_days >= 0),
  is_essential boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX financial_commitments_user_idx
  ON public.financial_commitments (user_id, active, ends_on);
CREATE INDEX financial_commitments_category_idx
  ON public.financial_commitments (user_id, category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_commitments TO authenticated;
GRANT ALL ON public.financial_commitments TO service_role;
ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own financial_commitments" ON public.financial_commitments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER touch_financial_commitments
  BEFORE UPDATE ON public.financial_commitments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
