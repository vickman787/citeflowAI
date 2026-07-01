-- migration 00000000000003_source_update_policy.sql

CREATE POLICY "Users can update own sources" ON public.sources 
FOR UPDATE TO authenticated 
USING (
  creator_id IN (
    SELECT id FROM public.creator_profiles WHERE user_id = auth.uid()
  )
);
