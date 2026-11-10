CREATE TABLE IF NOT EXISTS public.crm_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'completed',
  duration_seconds integer NOT NULL DEFAULT 0,
  phone_number text,
  summary text,
  recording_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_call_logs TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own call logs" ON public.crm_call_logs;
CREATE POLICY "Users manage their own call logs" ON public.crm_call_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_user ON public.crm_call_logs(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_contact ON public.crm_call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_deal ON public.crm_call_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_lead ON public.crm_call_logs(lead_id);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  reminder_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_tasks TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm tasks" ON public.crm_tasks;
CREATE POLICY "Users manage their own crm tasks" ON public.crm_tasks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_user ON public.crm_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON public.crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_deal ON public.crm_tasks(deal_id);

CREATE TABLE IF NOT EXISTS public.crm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  lead_sources jsonb NOT NULL DEFAULT '["Website", "Referral", "Cold Email", "LinkedIn", "Conference", "Inbound", "Partner"]'::jsonb,
  lost_reasons jsonb NOT NULL DEFAULT '["Price too high", "Competitor won", "Feature gap", "Budget freeze", "Bad timing", "Unresponsive", "Disqualified"]'::jsonb,
  territories jsonb NOT NULL DEFAULT '["North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Global"]'::jsonb,
  industries jsonb NOT NULL DEFAULT '["SaaS / Software", "Financial Services", "Healthcare", "E-commerce", "Manufacturing", "Consulting", "Real Estate", "Media / Marketing"]'::jsonb,
  default_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_settings TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm settings" ON public.crm_settings;
CREATE POLICY "Users manage their own crm settings" ON public.crm_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_settings_user ON public.crm_settings(user_id);

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS territory text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS territory text;

NOTIFY pgrst, 'reload schema';
