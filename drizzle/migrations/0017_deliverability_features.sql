ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS rotation_config_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recipient_timezone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_unsubscribe boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS variant_template_id uuid;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS variant text;
ALTER TABLE public.inbox_messages ADD COLUMN IF NOT EXISTS is_auto_reply boolean NOT NULL DEFAULT false;

UPDATE public.email_logs l SET config_id = c.config_id
FROM public.campaigns c
WHERE l.campaign_id = c.id AND l.config_id IS NULL AND l.sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_logs_config_sent_idx ON public.email_logs (config_id, sent_at);

CREATE TABLE public.suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppressions TO authenticated;
GRANT ALL ON public.suppressions TO service_role;
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suppressions" ON public.suppressions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);