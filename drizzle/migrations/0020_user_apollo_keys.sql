CREATE TABLE public.user_api_keys (
  user_id uuid NOT NULL,
  provider text NOT NULL,
  key_ciphertext text NOT NULL,
  hint text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
GRANT ALL ON public.user_api_keys TO service_role;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;