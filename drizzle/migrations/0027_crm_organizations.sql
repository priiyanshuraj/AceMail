CREATE TABLE public.crm_organizations (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_organizations TO authenticated;
GRANT ALL ON public.crm_organizations TO service_role;
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own crm organizations" ON public.crm_organizations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_crm_organizations_user ON public.crm_organizations(user_id);

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_contacts_organization ON public.contacts(organization_id);
