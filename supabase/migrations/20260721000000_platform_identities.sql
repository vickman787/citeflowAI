-- Platform identity verification: creators prove control of a domain or
-- platform handle before they can register content from it. This replaces
-- ad-hoc trust with a hard gate — registration checks this table before
-- any source row is created (see src/lib/verification).

CREATE TABLE public.platform_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('domain', 'x', 'medium', 'substack')),
    identifier TEXT NOT NULL, -- normalized hostname or handle, e.g. "vitalik.eth.limo" or "jack"
    proof_url TEXT NOT NULL,  -- the page/post URL that was checked for the code
    verification_code TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(platform, identifier) -- one identity can be claimed by exactly one creator
);

CREATE INDEX idx_platform_identities_creator ON public.platform_identities(creator_id);

ALTER TABLE public.platform_identities ENABLE ROW LEVEL SECURITY;

-- Public read so the registration gate (and UI badges) can check ownership;
-- writes only happen through the service-role verify endpoint.
CREATE POLICY "Platform identities are viewable by everyone" ON public.platform_identities
    FOR SELECT USING (true);

CREATE POLICY "Users can view their own identities for management" ON public.platform_identities
    FOR ALL TO authenticated USING (
        creator_id IN (SELECT id FROM public.creator_profiles WHERE user_id = auth.uid())
    );
