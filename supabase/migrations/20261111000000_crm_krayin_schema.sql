-- Complete CRM Schema for AceMail (Krayin CRM parity)
-- Applies Activities, Organizations, Products, Quotes, and Leads

-- 1. Activities
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  lead_id uuid,
  type text NOT NULL DEFAULT 'call',
  title text NOT NULL,
  description text,
  location text,
  schedule_from timestamptz,
  schedule_to timestamptz,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_activities TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm activities" ON public.crm_activities;
CREATE POLICY "Users manage their own crm activities" ON public.crm_activities
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user ON public.crm_activities(user_id, schedule_from);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON public.crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON public.crm_activities(deal_id);

-- 2. Organizations
CREATE TABLE IF NOT EXISTS public.crm_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  domain text,
  phone text,
  address text,
  city text,
  country text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_organizations TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm organizations" ON public.crm_organizations;
CREATE POLICY "Users manage their own crm organizations" ON public.crm_organizations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_user ON public.crm_organizations(user_id, name);

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON public.contacts(organization_id);

-- 3. Products & Deal Products
CREATE TABLE IF NOT EXISTS public.crm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sku text,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_products TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm products" ON public.crm_products;
CREATE POLICY "Users manage their own crm products" ON public.crm_products
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_products_user ON public.crm_products(user_id, name);

CREATE TABLE IF NOT EXISTS public.crm_deal_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.crm_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_deal_products TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_deal_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own deal products" ON public.crm_deal_products;
CREATE POLICY "Users manage their own deal products" ON public.crm_deal_products
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deal_products_deal ON public.crm_deal_products(deal_id);

-- 4. Quotes & Quote Items
CREATE TABLE IF NOT EXISTS public.crm_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  quote_number text,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  adjustment numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_address text,
  shipping_address text,
  description text,
  terms text,
  expired_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_quotes TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm quotes" ON public.crm_quotes;
CREATE POLICY "Users manage their own crm quotes" ON public.crm_quotes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_user ON public.crm_quotes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_deal ON public.crm_quotes(deal_id);

CREATE TABLE IF NOT EXISTS public.crm_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.crm_quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.crm_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);
GRANT ALL ON public.crm_quote_items TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own quote items" ON public.crm_quote_items;
CREATE POLICY "Users manage their own quote items" ON public.crm_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_quotes q WHERE q.id = crm_quote_items.quote_id AND q.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_quotes q WHERE q.id = crm_quote_items.quote_id AND q.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_quote_items_quote ON public.crm_quote_items(quote_id);

-- 5. Leads
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source text,
  type text,
  status text NOT NULL DEFAULT 'new',
  lead_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  expected_close date,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_leads TO postgres, anon, authenticated, service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm leads" ON public.crm_leads;
CREATE POLICY "Users manage their own crm leads" ON public.crm_leads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user ON public.crm_leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact ON public.crm_leads(contact_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_lead_id_fkey') THEN
    ALTER TABLE public.crm_activities ADD CONSTRAINT crm_activities_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS won_reason text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS territory text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS territory text;

-- 6. Call Logs (Frappe CRM parity)
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

-- 7. Tasks (Frappe CRM parity)
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

-- 8. Settings & Master Taxonomy (Frappe CRM parity)
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

NOTIFY pgrst, 'reload schema';
