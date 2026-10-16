ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

CREATE TABLE public.linkedin_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  list_id uuid NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'assisted',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_connect_limit int NOT NULL DEFAULT 20,
  daily_message_limit int NOT NULL DEFAULT 40,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_sequences TO authenticated;
GRANT ALL ON public.linkedin_sequences TO service_role;
ALTER TABLE public.linkedin_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sequences" ON public.linkedin_sequences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.linkedin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sequence_id uuid NOT NULL REFERENCES public.linkedin_sequences(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  action text NOT NULL,
  message text NOT NULL DEFAULT '',
  due_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, contact_id, step_index)
);
CREATE INDEX linkedin_tasks_due ON public.linkedin_tasks (user_id, status, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_tasks TO authenticated;
GRANT ALL ON public.linkedin_tasks TO service_role;
ALTER TABLE public.linkedin_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.linkedin_tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.linkedin_runner_tokens (
  user_id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.linkedin_runner_tokens TO authenticated;
GRANT ALL ON public.linkedin_runner_tokens TO service_role;
ALTER TABLE public.linkedin_runner_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own token read" ON public.linkedin_runner_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own token delete" ON public.linkedin_runner_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);