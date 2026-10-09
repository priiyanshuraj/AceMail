ALTER TABLE public.email_configurations
  ADD COLUMN provider text NOT NULL DEFAULT 'smtp',
  ADD COLUMN hourly_limit integer NOT NULL DEFAULT 20,
  ADD COLUMN warmup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN warmup_start_volume integer NOT NULL DEFAULT 5,
  ADD COLUMN warmup_increment integer NOT NULL DEFAULT 3,
  ADD COLUMN warmup_started_at timestamptz,
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN last_synced_at timestamptz;
ALTER TABLE public.email_configurations ALTER COLUMN smtp_host SET DEFAULT '', ALTER COLUMN smtp_username SET DEFAULT '', ALTER COLUMN smtp_password SET DEFAULT '';

ALTER TABLE public.email_logs
  ADD COLUMN gmail_message_id text,
  ADD COLUMN gmail_thread_id text,
  ADD COLUMN replied_at timestamptz;

CREATE TABLE public.mailbox_credentials (
  config_id uuid PRIMARY KEY REFERENCES public.email_configurations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  connection_key_ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mailbox_credentials TO service_role;
ALTER TABLE public.mailbox_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  config_id uuid REFERENCES public.email_configurations(id) ON DELETE CASCADE,
  log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, gmail_message_id)
);
GRANT SELECT, UPDATE, DELETE ON public.inbox_messages TO authenticated;
GRANT ALL ON public.inbox_messages TO service_role;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inbox select" ON public.inbox_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own inbox update" ON public.inbox_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own inbox delete" ON public.inbox_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX inbox_messages_user_idx ON public.inbox_messages(user_id, received_at DESC);