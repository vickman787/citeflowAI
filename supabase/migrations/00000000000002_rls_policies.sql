-- migration 00000000000002_rls_policies.sql

-- Research Sessions
CREATE POLICY "Users can manage own sessions" ON public.research_sessions 
FOR ALL TO authenticated USING (user_id = auth.uid());

-- Citation Decisions
CREATE POLICY "Users can manage own citation decisions" ON public.citation_decisions 
FOR ALL TO authenticated USING (
    session_id IN (SELECT id FROM public.research_sessions WHERE user_id = auth.uid())
);

-- Payment Authorizations
CREATE POLICY "Users can manage own payment auths" ON public.payment_authorizations 
FOR ALL TO authenticated USING (
    session_id IN (SELECT id FROM public.research_sessions WHERE user_id = auth.uid())
);

-- Payment Settlements
CREATE POLICY "Users can manage own settlements" ON public.payment_settlements 
FOR ALL TO authenticated USING (
    authorization_id IN (
        SELECT authorization_id FROM public.payment_authorizations WHERE session_id IN (
            SELECT id FROM public.research_sessions WHERE user_id = auth.uid()
        )
    )
);

-- Audit Events
CREATE POLICY "Anyone can insert audit events" ON public.audit_events 
FOR INSERT TO authenticated WITH CHECK (true);

-- Treasury Limits
CREATE POLICY "Anyone can view and update treasury" ON public.treasury_limits
FOR ALL TO authenticated USING (true);
