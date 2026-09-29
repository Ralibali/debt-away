-- Read-only open-banking pilot metadata.
-- No bank credentials, provider private keys, access tokens, balances or transactions
-- belong in this table. Provider secrets must stay server-side.
CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'open_banking',
  provider_connection_id text NOT NULL,
  institution_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','active','expired','revoked','error')
  ),
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_connection_id)
);

CREATE INDEX bank_connections_user_status_idx
  ON public.bank_connections (user_id, status, consent_expires_at);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bank_connections FROM anon, authenticated;
GRANT SELECT ON TABLE public.bank_connections TO authenticated;
GRANT ALL ON TABLE public.bank_connections TO service_role;

CREATE POLICY "bank_connections_select_own"
  ON public.bank_connections
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER touch_bank_connections
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
