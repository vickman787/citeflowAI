-- Hard network isolation for sources, sessions and payment authorizations.
--
-- Previously isolation was inferred from a timestamp (MAINNET_EPOCH): anything
-- created on or after the cutover counted as mainnet. That is fragile, because a
-- source registered on TESTNET after the cutover would be treated as a mainnet
-- source and could be cited on mainnet with a testnet creator wallet.
--
-- This migration tags each row with the network it actually belongs to, so the
-- agent can cite only sources registered on the active network. Every existing
-- row is backfilled to 'arc-testnet' (the network the platform has been running),
-- so nothing leaks into mainnet. Sources are re-tagged when re-registered on
-- mainnet.
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'arc-testnet';

ALTER TABLE public.research_sessions
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'arc-testnet';

ALTER TABLE public.payment_authorizations
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'arc-testnet';

CREATE INDEX IF NOT EXISTS idx_sources_network_status
  ON public.sources(network, status);

CREATE INDEX IF NOT EXISTS idx_research_sessions_network
  ON public.research_sessions(network);

CREATE INDEX IF NOT EXISTS idx_payment_authorizations_network
  ON public.payment_authorizations(network);
