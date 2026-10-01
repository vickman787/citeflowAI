-- Apply before deploying the application changes. Existing rows are preserved.
ALTER TABLE public.research_sessions ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE public.research_sessions ADD COLUMN IF NOT EXISTS funding_transaction_id TEXT;
ALTER TABLE public.research_sessions ADD COLUMN IF NOT EXISTS payer_address TEXT;
ALTER TABLE public.research_sessions ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.platform_identities ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'arc-testnet';
ALTER TABLE public.treasury_limits ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'arc-testnet';
ALTER TABLE public.treasury_limits DROP CONSTRAINT IF EXISTS treasury_limits_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS treasury_limits_date_network_key ON public.treasury_limits(date, network);

ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS sources_url_network_key ON public.sources(url, network);

ALTER TABLE public.platform_identities DROP CONSTRAINT IF EXISTS platform_identities_platform_identifier_key;
ALTER TABLE public.platform_identities DROP CONSTRAINT IF EXISTS platform_identities_platform_check;
ALTER TABLE public.platform_identities ADD CONSTRAINT platform_identities_platform_check
  CHECK (platform IN ('domain','x','medium','substack','arc','ghost','mirror','paragraph','hashnode','devto','beehiiv','farcaster','youtube','lens','github'));
CREATE UNIQUE INDEX IF NOT EXISTS platform_identities_platform_identifier_network_key
  ON public.platform_identities(platform, identifier, network);

CREATE UNIQUE INDEX IF NOT EXISTS payment_settlements_authorization_unique
  ON public.payment_settlements(authorization_id);
ALTER TABLE public.payment_settlements ADD COLUMN IF NOT EXISTS recipient_wallet TEXT;
ALTER TABLE public.payment_settlements ADD COLUMN IF NOT EXISTS payout_amount_usdc NUMERIC(10,6);
ALTER TABLE public.payment_settlements ADD COLUMN IF NOT EXISTS network TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS audit_events_funding_transaction_unique
  ON public.audit_events((details->>'transactionId')) WHERE event_type = 'funding_tx_used';
CREATE UNIQUE INDEX IF NOT EXISTS pending_refunds_session_unique
  ON public.pending_refunds(session_id);
ALTER TABLE public.pending_refunds ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

CREATE TABLE IF NOT EXISTS public.gateway_sweeps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  network TEXT NOT NULL CHECK (network = 'arc-mainnet'),
  amount_usdc NUMERIC(10,6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  attestation TEXT,
  gateway_signature TEXT,
  mint_transaction_id TEXT,
  transaction_hash TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gateway_sweeps_one_active
  ON public.gateway_sweeps(network) WHERE status IN ('processing','submitted');
ALTER TABLE public.gateway_sweeps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gateway_sweeps FROM anon, authenticated;

-- Drop any permissive policies that were applied directly to the live project.
DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN
           ('payment_authorizations','payment_settlements','treasury_limits','audit_events','pending_refunds',
            'research_sessions','citation_decisions','platform_identities') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

REVOKE ALL ON public.payment_authorizations, public.payment_settlements,
  public.treasury_limits, public.audit_events, public.pending_refunds FROM anon, authenticated;
GRANT SELECT ON public.payment_authorizations, public.payment_settlements TO authenticated;

CREATE POLICY payment_authorizations_owner_read ON public.payment_authorizations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.research_sessions rs
            WHERE rs.id = session_id AND rs.user_id = auth.uid()));
CREATE POLICY payment_settlements_owner_read ON public.payment_settlements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payment_authorizations pa
            JOIN public.research_sessions rs ON rs.id = pa.session_id
            WHERE pa.authorization_id = payment_settlements.authorization_id AND rs.user_id = auth.uid()));
CREATE POLICY research_sessions_owner_read ON public.research_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY citation_decisions_owner_read ON public.citation_decisions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.research_sessions rs WHERE rs.id = session_id AND rs.user_id = auth.uid()));
CREATE POLICY platform_identities_owner_read ON public.platform_identities
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid()));

-- Registration still uses the signed-in creator client. Prevent direct writes
-- that impersonate another creator, including chunk deletion/poisoning.
DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('sources','source_chunks')
             AND cmd IN ('INSERT','UPDATE','DELETE','ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;
CREATE POLICY sources_creator_insert ON public.sources FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid()));
CREATE POLICY sources_creator_update ON public.sources FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid()));
CREATE POLICY source_chunks_creator_insert ON public.source_chunks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sources s JOIN public.creator_profiles cp ON cp.id = s.creator_id
                     WHERE s.id = source_id AND cp.user_id = auth.uid()));
CREATE POLICY source_chunks_creator_delete ON public.source_chunks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sources s JOIN public.creator_profiles cp ON cp.id = s.creator_id
                 WHERE s.id = source_id AND cp.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.claim_license_authorization(
  p_authorization_id TEXT, p_source_id UUID, p_network TEXT)
RETURNS TABLE(amount_usdc NUMERIC, recipient_wallet TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount NUMERIC; v_wallet TEXT;
BEGIN
  SELECT pa.amount_usdc, p.wallet_address INTO v_amount, v_wallet
    FROM public.payment_authorizations pa
    JOIN public.research_sessions rs ON rs.id = pa.session_id
    JOIN public.sources s ON s.id = pa.source_id
    JOIN public.creator_profiles cp ON cp.id = s.creator_id
    JOIN public.profiles p ON p.id = cp.user_id
   WHERE pa.authorization_id = p_authorization_id AND pa.source_id = p_source_id
     AND pa.network = p_network AND rs.network = p_network AND rs.status = 'active' AND s.network = p_network
     AND s.status = 'extracted' AND pa.status = 'pending'
     AND pa.amount_usdc = s.price_usdc AND pa.amount_usdc > 0
   FOR UPDATE OF pa;
  IF v_amount IS NULL OR v_wallet IS NULL OR v_wallet !~* '^0x[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'Authorization is used, mismatched, or has no recipient';
  END IF;
  UPDATE public.payment_authorizations SET status = 'processing'
   WHERE authorization_id = p_authorization_id AND status = 'pending';
  RETURN QUERY SELECT v_amount, v_wallet;
END $$;
REVOKE ALL ON FUNCTION public.claim_license_authorization(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_license_authorization(TEXT, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_license_authorization(
  p_session_id UUID, p_source_id UUID, p_network TEXT,
  p_authorization_id TEXT, p_daily_limit NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_price NUMERIC; v_budget NUMERIC; v_spent NUMERIC; v_daily_spent NUMERIC; v_limit NUMERIC;
BEGIN
  IF p_network NOT IN ('arc-testnet','arc-mainnet') OR p_daily_limit <= 0 THEN
    RAISE EXCEPTION 'Invalid network or treasury limit';
  END IF;
  SELECT budget_usdc INTO v_budget FROM public.research_sessions
   WHERE id = p_session_id AND network = p_network AND status = 'active' FOR UPDATE;
  SELECT price_usdc INTO v_price FROM public.sources
   WHERE id = p_source_id AND network = p_network AND status = 'extracted';
  IF v_budget IS NULL OR v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'Session/source unavailable'; END IF;

  INSERT INTO public.treasury_limits(date, network, daily_limit_usdc)
    VALUES (CURRENT_DATE, p_network, p_daily_limit)
    ON CONFLICT (date, network) DO NOTHING;
  SELECT spent_today_usdc, daily_limit_usdc INTO v_daily_spent, v_limit
    FROM public.treasury_limits WHERE date = CURRENT_DATE AND network = p_network FOR UPDATE;
  SELECT COALESCE(SUM(amount_usdc), 0) INTO v_spent FROM public.payment_authorizations
   WHERE session_id = p_session_id AND status <> 'failed';
  IF v_spent + v_price > v_budget THEN RAISE EXCEPTION 'Research session budget exceeded'; END IF;
  IF v_daily_spent + v_price > v_limit THEN RAISE EXCEPTION 'Treasury daily spending limit reached'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_authorizations WHERE session_id = p_session_id AND source_id = p_source_id) THEN
    RAISE EXCEPTION 'Source already authorized in this session';
  END IF;
  INSERT INTO public.payment_authorizations(session_id, source_id, authorization_id, amount_usdc, network, status)
    VALUES (p_session_id, p_source_id, p_authorization_id, v_price, p_network, 'pending');
  UPDATE public.treasury_limits SET spent_today_usdc = v_daily_spent + v_price
   WHERE date = CURRENT_DATE AND network = p_network;
  RETURN v_price;
END $$;
REVOKE ALL ON FUNCTION public.reserve_license_authorization(UUID, UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_license_authorization(UUID, UUID, TEXT, TEXT, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_pending_refunds(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.pending_refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH ready AS (
    SELECT id FROM public.pending_refunds
     WHERE (status = 'pending' OR (status = 'processing' AND paid_transaction_id IS NULL
            AND updated_at < now() - interval '10 minutes')) AND attempts < 5
     ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(p_limit, 25)
  )
  UPDATE public.pending_refunds pr SET status = 'processing', attempts = attempts + 1,
    updated_at = now()
  FROM ready WHERE pr.id = ready.id RETURNING pr.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_pending_refunds(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_refunds(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_refund(p_id UUID)
RETURNS SETOF public.pending_refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY UPDATE public.pending_refunds pr SET status = 'processing',
    attempts = attempts + 1, updated_at = now()
   WHERE pr.id = p_id AND pr.status = 'pending' AND pr.attempts < 5
   RETURNING pr.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_refund(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_refund(UUID) TO service_role;
