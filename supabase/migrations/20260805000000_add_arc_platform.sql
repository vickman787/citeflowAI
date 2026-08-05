-- Adds Arc House (community.arc.io) as a fifth verifiable source platform.
--
-- The platform list is a CHECK constraint rather than application logic on
-- purpose (see 20260721000000_platform_identities.sql), so adding a platform
-- means widening the constraint here as well as teaching src/lib/verification
-- how to resolve it.

ALTER TABLE public.platform_identities
    DROP CONSTRAINT IF EXISTS platform_identities_platform_check;

ALTER TABLE public.platform_identities
    ADD CONSTRAINT platform_identities_platform_check
    CHECK (platform IN ('domain', 'x', 'medium', 'substack', 'arc'));

-- For 'arc' the identifier is the author's nanoId (e.g. "sv98lohp0c"), not the
-- full profile slug. The slug embeds the member's display name, so keying on it
-- would orphan a verified identity the moment someone renames themselves.
COMMENT ON COLUMN public.platform_identities.identifier IS
    'Normalized hostname or handle, e.g. "vitalik.eth.limo", "jack", or an Arc House author nanoId "sv98lohp0c".';
