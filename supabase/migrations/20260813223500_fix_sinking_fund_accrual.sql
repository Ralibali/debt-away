-- Tidigare var monthly_accrual GENERATED ALWAYS samtidigt som klienten skickar
-- ett beräknat värde. PostgreSQL avvisar explicita writes till genererade kolumner.
-- Behåll samma invarians via trigger i stället.
ALTER TABLE public.sinking_funds
  DROP COLUMN monthly_accrual;

ALTER TABLE public.sinking_funds
  ADD COLUMN monthly_accrual numeric NOT NULL DEFAULT 0;

UPDATE public.sinking_funds
SET monthly_accrual = round((annual_estimate / 12)::numeric, 2);

CREATE OR REPLACE FUNCTION public.set_sinking_fund_monthly_accrual()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.monthly_accrual := round((NEW.annual_estimate / 12)::numeric, 2);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_sinking_fund_monthly_accrual
BEFORE INSERT OR UPDATE OF annual_estimate, monthly_accrual
ON public.sinking_funds
FOR EACH ROW EXECUTE FUNCTION public.set_sinking_fund_monthly_accrual();
