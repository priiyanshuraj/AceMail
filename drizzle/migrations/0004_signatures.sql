ALTER TABLE public.email_templates ADD COLUMN attach_signature boolean NOT NULL DEFAULT false;
CREATE TABLE public.user_signatures (user_id uuid PRIMARY KEY, signature text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_signatures TO authenticated;
GRANT ALL ON public.user_signatures TO service_role;
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own signature" ON public.user_signatures FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);