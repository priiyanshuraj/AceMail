CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_email_limit integer NOT NULL DEFAULT 20,
  default_linkedin_limit integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ai_settings (id) VALUES (true);
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_ai_limits (
  user_id uuid PRIMARY KEY,
  ai_enabled boolean NOT NULL DEFAULT true,
  daily_email_limit integer,
  daily_linkedin_limit integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_ai_limits TO service_role;
ALTER TABLE public.user_ai_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_ai_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  emails_generated integer NOT NULL DEFAULT 0,
  linkedin_generated integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
GRANT ALL ON public.user_ai_usage TO service_role;
ALTER TABLE public.user_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(_user_id uuid, _kind text, _limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
  INSERT INTO public.user_ai_usage (user_id, usage_date) VALUES (_user_id, (now() AT TIME ZONE 'utc')::date)
  ON CONFLICT DO NOTHING;
  IF _kind = 'linkedin' THEN
    UPDATE public.user_ai_usage SET linkedin_generated = linkedin_generated + 1
    WHERE user_id = _user_id AND usage_date = (now() AT TIME ZONE 'utc')::date AND linkedin_generated < _limit
    RETURNING linkedin_generated INTO used;
  ELSE
    UPDATE public.user_ai_usage SET emails_generated = emails_generated + 1
    WHERE user_id = _user_id AND usage_date = (now() AT TIME ZONE 'utc')::date AND emails_generated < _limit
    RETURNING emails_generated INTO used;
  END IF;
  RETURN used IS NOT NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, text, integer) TO service_role;

INSERT INTO public.user_roles (user_id, role) VALUES ('8310a37e-a08b-4f75-8874-4cda75d4d25e', 'admin') ON CONFLICT DO NOTHING;