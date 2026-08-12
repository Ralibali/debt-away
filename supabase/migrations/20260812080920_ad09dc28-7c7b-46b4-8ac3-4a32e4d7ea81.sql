-- 1. Import profiles
CREATE TABLE public.import_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  account_id uuid REFERENCES public.accounts ON DELETE SET NULL,
  delimiter text NOT NULL DEFAULT ';',
  encoding text NOT NULL DEFAULT 'utf-8',
  header_row int NOT NULL DEFAULT 0,
  date_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  column_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount_mode text NOT NULL DEFAULT 'signed' CHECK (amount_mode IN ('signed','two_column')),
  sign_flip boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_profiles TO authenticated;
GRANT ALL ON public.import_profiles TO service_role;
ALTER TABLE public.import_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own import_profiles" ON public.import_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Transactions: import metadata + lock
ALTER TABLE public.transactions
  ADD COLUMN import_hash text,
  ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import')),
  ADD COLUMN raw_description text,
  ADD COLUMN booking_date date,
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX transactions_user_import_hash_key
  ON public.transactions (user_id, import_hash) WHERE import_hash IS NOT NULL;

-- 3. Transaction splits
CREATE TABLE public.transaction_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories ON DELETE SET NULL,
  amount numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transaction_splits_transaction_idx ON public.transaction_splits (transaction_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_splits TO authenticated;
GRANT ALL ON public.transaction_splits TO service_role;
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transaction_splits" ON public.transaction_splits FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Merchant rules
CREATE TABLE public.merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pattern text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories ON DELETE CASCADE,
  match_type text NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains','exact','regex')),
  hit_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern, match_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_rules TO authenticated;
GRANT ALL ON public.merchant_rules TO service_role;
ALTER TABLE public.merchant_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own merchant_rules" ON public.merchant_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. User parameters
CREATE TABLE public.user_parameters (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  isk_fribelopp numeric NOT NULL DEFAULT 300000,
  isk_schablonranta numeric NOT NULL DEFAULT 0.0355,
  kapitalskatt numeric NOT NULL DEFAULT 0.30,
  ranteavdrag_sakerhet numeric NOT NULL DEFAULT 0.30,
  ranteavdrag_utan_sakerhet numeric NOT NULL DEFAULT 0.00,
  monthly_net_income numeric,
  hourly_net_wage numeric,
  buffer_months numeric NOT NULL DEFAULT 3,
  expected_return numeric NOT NULL DEFAULT 0.07,
  cooldown_small_hours int NOT NULL DEFAULT 48,
  cooldown_medium_days int NOT NULL DEFAULT 7,
  cooldown_large_days int NOT NULL DEFAULT 30,
  cooldown_small_limit numeric NOT NULL DEFAULT 500,
  cooldown_large_limit numeric NOT NULL DEFAULT 2000,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_parameters TO authenticated;
GRANT ALL ON public.user_parameters TO service_role;
ALTER TABLE public.user_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_parameters" ON public.user_parameters FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Parameter change log
CREATE TABLE public.parameter_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parameter_changes_user_idx ON public.parameter_changes (user_id, changed_at DESC);
GRANT SELECT, INSERT ON public.parameter_changes TO authenticated;
GRANT ALL ON public.parameter_changes TO service_role;
ALTER TABLE public.parameter_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own parameter_changes read" ON public.parameter_changes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own parameter_changes insert" ON public.parameter_changes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. Manual override of loan balance
ALTER TABLE public.loans
  ADD COLUMN manual_balance numeric,
  ADD COLUMN manual_balance_at timestamptz;

-- 8. updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER import_profiles_touch BEFORE UPDATE ON public.import_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER user_parameters_touch BEFORE UPDATE ON public.user_parameters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();