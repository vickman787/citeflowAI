-- Atomic replay protection for the standard EIP-3009 agent payment rail.
--
-- Each signed EIP-3009 authorization carries a unique nonce and may only ever
-- fund one research session. The route checks for prior use before serving, but
-- check-then-insert is not race-free; this partial unique index is the atomic
-- backstop. When the route's insert hits this index it returns HTTP 409 instead
-- of paying creators twice.
--
-- Safe to run on a populated table: partial index over a single jsonb field,
-- no data migration required.
CREATE UNIQUE INDEX IF NOT EXISTS audit_events_agent_eip3009_nonce_key
  ON public.audit_events ((details->>'nonce'))
  WHERE event_type = 'agent_eip3009_auth_used';
