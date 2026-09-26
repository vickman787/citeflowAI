-- Durable refund queue.
--
-- Circle Gateway settlement is batched and asynchronous, so a buyer's payment
-- reaches the treasury's Gateway balance some time after settlement, and only
-- reaches the on-chain wallet after a sweep. An inline refund therefore cannot
-- reliably draw on the same session's funds.
--
-- Every refund owed is recorded here. The inline refund is still attempted for
-- speed, but if it fails (typically insufficient on-chain float) the row stays
-- `pending` and the scheduled disbursement endpoint pays it once funds have been
-- swept on-chain.
CREATE TABLE IF NOT EXISTS public.pending_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID,
    payer_address TEXT NOT NULL,
    amount_usdc NUMERIC(10, 6) NOT NULL,
    network TEXT NOT NULL DEFAULT 'arc-testnet',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    paid_transaction_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pending_refunds_status
  ON public.pending_refunds(status);

CREATE INDEX IF NOT EXISTS idx_pending_refunds_network_status
  ON public.pending_refunds(network, status);

ALTER TABLE public.pending_refunds ENABLE ROW LEVEL SECURITY;
