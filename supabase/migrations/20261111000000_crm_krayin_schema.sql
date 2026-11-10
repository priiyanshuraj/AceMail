-- ==============================================================================
-- AceMail CRM: Complete Master Schema (Krayin CRM + Frappe CRM Parity)
-- Safe, idempotent, fully-ordered schema for all 13 CRM modules and RLS policies.
-- ==============================================================================

-- 1. Stages
CREATE TABLE IF NOT EXISTS public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  position integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_stages TO authenticated, service_role;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm stages" ON public.crm_stages;
CREATE POLICY "Users manage their own crm stages" ON public.crm_stages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_stages_user ON public.crm_stages(user_id, position);

-- 2. Organizations
CREATE TABLE IF NOT EXISTS public.crm_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  website text,
  phone text,
  address text,
  city text,
  country text,
  industry text,
  description text,
  employee_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_organizations TO authenticated, service_role;
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm organizations" ON public.crm_organizations;
CREATE POLICY "Users manage their own crm organizations" ON public.crm_organizations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_user ON public.crm_organizations(user_id);

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON public.contacts(organization_id);

-- 3. Deals (Sales Funnel & Kanban)
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT '',
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  expected_close date,
  position integer NOT NULL DEFAULT 0,
  lost_reason text,
  won_reason text,
  priority text NOT NULL DEFAULT 'medium',
  territory text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_deals TO authenticated, service_role;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm deals" ON public.crm_deals;
CREATE POLICY "Users manage their own crm deals" ON public.crm_deals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_user_stage ON public.crm_deals(user_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON public.crm_deals(contact_id);

-- Ensure deal columns exist if table was previously partially created
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS won_reason text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS territory text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS source text;

-- 4. Notes & Reminders
CREATE TABLE IF NOT EXISTS public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  body text NOT NULL,
  remind_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_notes TO authenticated, service_role;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm notes" ON public.crm_notes;
CREATE POLICY "Users manage their own crm notes" ON public.crm_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_contact ON public.crm_notes(contact_id);

-- 5. Products catalog
CREATE TABLE IF NOT EXISTS public.crm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  type text NOT NULL DEFAULT 'product',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_products TO authenticated, service_role;
ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm products" ON public.crm_products;
CREATE POLICY "Users manage their own crm products" ON public.crm_products
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_products_user ON public.crm_products(user_id);

-- 6. Deal line items (Deal Products)
CREATE TABLE IF NOT EXISTS public.crm_deal_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.crm_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_deal_products TO authenticated, service_role;
ALTER TABLE public.crm_deal_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage crm deal products via deals" ON public.crm_deal_products;
CREATE POLICY "Users manage crm deal products via deals" ON public.crm_deal_products
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_deals WHERE id = deal_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deals WHERE id = deal_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_deal_products_deal ON public.crm_deal_products(deal_id);

-- 7. Leads (Inbound / Prospects)
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
  priority text NOT NULL DEFAULT 'medium',
  territory text,
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
GRANT ALL ON public.crm_leads TO authenticated, service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm leads" ON public.crm_leads;
CREATE POLICY "Users manage their own crm leads" ON public.crm_leads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user ON public.crm_leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact ON public.crm_leads(contact_id);

ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS territory text;

-- 8. Activities (Calls, Meetings, Tasks, Lunches)
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
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
GRANT ALL ON public.crm_activities TO authenticated, service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm activities" ON public.crm_activities;
CREATE POLICY "Users manage their own crm activities" ON public.crm_activities
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user ON public.crm_activities(user_id, schedule_from);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON public.crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON public.crm_activities(deal_id);

-- 9. Quotes & Proposals
CREATE TABLE IF NOT EXISTS public.crm_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  notes text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_quotes TO authenticated, service_role;
ALTER TABLE public.crm_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm quotes" ON public.crm_quotes;
CREATE POLICY "Users manage their own crm quotes" ON public.crm_quotes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_user ON public.crm_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_deal ON public.crm_quotes(deal_id);

-- 10. Quote Items
CREATE TABLE IF NOT EXISTS public.crm_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.crm_quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.crm_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_pct numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.crm_quote_items TO authenticated, service_role;
ALTER TABLE public.crm_quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage crm quote items via quotes" ON public.crm_quote_items;
CREATE POLICY "Users manage crm quote items via quotes" ON public.crm_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_quotes WHERE id = quote_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_quotes WHERE id = quote_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_crm_quote_items_quote ON public.crm_quote_items(quote_id, position);

-- 11. Call Logs (Frappe CRM parity)
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
GRANT ALL ON public.crm_call_logs TO authenticated, service_role;
ALTER TABLE public.crm_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own call logs" ON public.crm_call_logs;
CREATE POLICY "Users manage their own call logs" ON public.crm_call_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_user ON public.crm_call_logs(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_contact ON public.crm_call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_deal ON public.crm_call_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_lead ON public.crm_call_logs(lead_id);

-- 12. Tasks Manager (Frappe CRM parity)
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
GRANT ALL ON public.crm_tasks TO authenticated, service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm tasks" ON public.crm_tasks;
CREATE POLICY "Users manage their own crm tasks" ON public.crm_tasks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_user ON public.crm_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON public.crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_deal ON public.crm_tasks(deal_id);

-- 13. Settings & Master Taxonomy (Frappe CRM parity)
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
GRANT ALL ON public.crm_settings TO authenticated, service_role;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own crm settings" ON public.crm_settings;
CREATE POLICY "Users manage their own crm settings" ON public.crm_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_crm_settings_user ON public.crm_settings(user_id);

-- 14. Auto-advance deal to "Replied" stage when contact replies to an email
CREATE OR REPLACE FUNCTION public.crm_advance_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st record;
BEGIN
  IF NEW.contact_id IS NULL OR NEW.is_auto_reply THEN RETURN NEW; END IF;
  SELECT id, position INTO st FROM public.crm_stages
   WHERE user_id = NEW.user_id AND lower(name) = 'replied' LIMIT 1;
  IF st.id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.crm_deals d SET stage_id = st.id, updated_at = now()
   FROM public.crm_stages s
   WHERE d.stage_id = s.id AND d.user_id = NEW.user_id AND d.contact_id = NEW.contact_id
     AND s.position < st.position AND NOT s.is_won AND NOT s.is_lost;
  IF NOT EXISTS (SELECT 1 FROM public.crm_deals WHERE user_id = NEW.user_id AND contact_id = NEW.contact_id) THEN
    INSERT INTO public.crm_deals (user_id, contact_id, stage_id, title)
    VALUES (NEW.user_id, NEW.contact_id, st.id, 'Reply from ' || coalesce(nullif(NEW.from_name, ''), NEW.from_email));
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbox_messages') THEN
    DROP TRIGGER IF EXISTS crm_advance_on_reply ON public.inbox_messages;
    CREATE TRIGGER crm_advance_on_reply AFTER INSERT ON public.inbox_messages
    FOR EACH ROW EXECUTE FUNCTION public.crm_advance_on_reply();
  END IF;
END $$;

-- Reload Supabase PostgREST schema cache
NOTIFY pgrst, 'reload schema';
