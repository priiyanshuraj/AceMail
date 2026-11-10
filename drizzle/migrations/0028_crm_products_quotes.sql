CREATE TABLE public.crm_products (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_products TO authenticated;
GRANT ALL ON public.crm_products TO service_role;
ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own crm products" ON public.crm_products
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_crm_products_user ON public.crm_products(user_id);

CREATE TABLE public.crm_deal_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.crm_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deal_products TO authenticated;
GRANT ALL ON public.crm_deal_products TO service_role;
ALTER TABLE public.crm_deal_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage crm deal products via deals" ON public.crm_deal_products
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_deals WHERE id = deal_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deals WHERE id = deal_id AND user_id = auth.uid()));
CREATE INDEX idx_crm_deal_products_deal ON public.crm_deal_products(deal_id);

CREATE TABLE public.crm_quotes (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quotes TO authenticated;
GRANT ALL ON public.crm_quotes TO service_role;
ALTER TABLE public.crm_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own crm quotes" ON public.crm_quotes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_crm_quotes_user ON public.crm_quotes(user_id);
CREATE INDEX idx_crm_quotes_deal ON public.crm_quotes(deal_id);

CREATE TABLE public.crm_quote_items (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quote_items TO authenticated;
GRANT ALL ON public.crm_quote_items TO service_role;
ALTER TABLE public.crm_quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage crm quote items via quotes" ON public.crm_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_quotes WHERE id = quote_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_quotes WHERE id = quote_id AND user_id = auth.uid()));
CREATE INDEX idx_crm_quote_items_quote ON public.crm_quote_items(quote_id, position);
