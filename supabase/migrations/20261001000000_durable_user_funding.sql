-- Record a Circle user-controlled funding challenge before the PIN is shown.
BEGIN;
ALTER TABLE public.research_sessions
  ADD COLUMN IF NOT EXISTS funding_challenge_id TEXT,
  ADD COLUMN IF NOT EXISTS circle_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS research_sessions_funding_challenge_unique
  ON public.research_sessions(funding_challenge_id)
  WHERE funding_challenge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_sessions_funding_transaction_unique
  ON public.research_sessions(network, funding_transaction_id)
  WHERE funding_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_sessions_one_open_user_funding
  ON public.research_sessions(user_id, network)
  WHERE funding_challenge_id IS NOT NULL
    AND status IN ('awaiting_funding', 'funding_pending', 'active', 'payment_review', 'refund_pending');

-- A compare-and-set claim prevents two requests from running the same research.
CREATE OR REPLACE FUNCTION public.claim_confirmed_user_research(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claimed UUID;
BEGIN
  UPDATE public.research_sessions
     SET status = 'active'
   WHERE id = p_session_id
     AND status IN ('awaiting_funding', 'funding_pending')
     AND funding_challenge_id IS NOT NULL
     AND funding_transaction_id IS NOT NULL
  RETURNING id INTO v_claimed;
  RETURN v_claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_confirmed_user_research(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_confirmed_user_research(UUID) TO service_role;

COMMIT;
