CREATE TABLE public.linkedin_cloud_sessions (
  user_id uuid PRIMARY KEY,
  cookie_enc text NOT NULL,
  proxy_enc text,
  cookie_hint text,
  status text NOT NULL DEFAULT 'connected',
  status_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.linkedin_cloud_sessions TO service_role;
ALTER TABLE public.linkedin_cloud_sessions ENABLE ROW LEVEL SECURITY;