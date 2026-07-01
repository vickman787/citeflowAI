-- Initial Schema for CiteFlow

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- assuming we will use pgvector for embeddings

-- 1. Profiles (extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    wallet_address TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Creator Profiles
CREATE TABLE public.creator_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- 3. Sources (Registered Articles)
CREATE TABLE public.sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES public.creator_profiles(id) ON DELETE SET NULL,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    content_hash TEXT,
    price_usdc NUMERIC(10, 6) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, extracted, failed, verified
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Source Chunks
CREATE TABLE public.source_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- assuming OpenAI ada-002 or similar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Ownership Verifications
CREATE TABLE public.ownership_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(source_id, creator_id)
);

-- 6. Research Sessions
CREATE TABLE public.research_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    budget_usdc NUMERIC(10, 6) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Citation Decisions
CREATE TABLE public.citation_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.research_sessions(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    contribution_score NUMERIC(5, 4),
    accepted BOOLEAN NOT NULL DEFAULT false,
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Payment Authorizations
CREATE TABLE public.payment_authorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.research_sessions(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    authorization_id TEXT NOT NULL UNIQUE,
    amount_usdc NUMERIC(10, 6) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Payment Settlements
CREATE TABLE public.payment_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    authorization_id TEXT NOT NULL REFERENCES public.payment_authorizations(authorization_id) ON DELETE CASCADE,
    gateway_settlement_id TEXT UNIQUE,
    transaction_hash TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Treasury Limits
CREATE TABLE public.treasury_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    daily_limit_usdc NUMERIC(10, 6) NOT NULL DEFAULT 100.00,
    spent_today_usdc NUMERIC(10, 6) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Audit Events
CREATE TABLE public.audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Profiles: Users can read and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Creator Profiles: Public read, users can update their own
CREATE POLICY "Creator profiles are viewable by everyone" ON public.creator_profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage their creator profile" ON public.creator_profiles FOR ALL USING (user_id = auth.uid());

-- Sources: Public read, authenticated users can insert (status starts as pending)
CREATE POLICY "Sources are viewable by everyone" ON public.sources FOR SELECT USING (true);
CREATE POLICY "Users can insert sources" ON public.sources FOR INSERT TO authenticated WITH CHECK (true);

-- Source Chunks: Public read
CREATE POLICY "Source chunks are viewable by everyone" ON public.source_chunks FOR SELECT USING (true);

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_creator_profiles_updated_at BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
