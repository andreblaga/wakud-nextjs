-- ============================================================================
-- WAKUD PLANT COMMAND — Full database setup
-- ============================================================================
-- Paste this entire file into the Supabase SQL Editor of your NEW project and
-- click "Run". It rebuilds the complete schema: all tables, security rules,
-- the document storage bucket, and essential reference data.
--
-- Safe to run more than once (idempotent).
-- It does NOT insert demo business data — the system starts empty and ready
-- for your real data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. User roles (created before has_role(), which reads from this table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gm','operations','sales','finance')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Role helper function (used by security rules)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
DROP POLICY IF EXISTS "Authenticated can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "GM can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
CREATE POLICY "Authenticated can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "GM can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gm'));
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Deals (trade evaluation & pipeline)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('production','arbitrage')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','confirmed','in_transit','delivered','paid')),
  buyer TEXT NOT NULL,
  input_product TEXT NOT NULL DEFAULT '',
  output_product TEXT NOT NULL DEFAULT '',
  producer TEXT NOT NULL DEFAULT '',
  disport TEXT NOT NULL DEFAULT '',
  tonnes DECIMAL NOT NULL,
  buy_price_per_tonne DECIMAL NOT NULL,
  sell_price_per_tonne DECIMAL NOT NULL,
  shipping_per_tonne DECIMAL DEFAULT 0,
  trucking_per_tonne DECIMAL DEFAULT 0,
  payment_type TEXT,
  vat_rate DECIMAL DEFAULT 0.05,
  funding_rate DECIMAL DEFAULT 0.10,
  total_cost DECIMAL,
  total_revenue DECIMAL,
  profit DECIMAL,
  margin DECIMAL,
  profit_per_tonne DECIMAL,
  pre_funding_required DECIMAL,
  start_month DATE,
  end_month DATE,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read deals" ON public.deals;
DROP POLICY IF EXISTS "Auth can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Auth can update deals" ON public.deals;
DROP POLICY IF EXISTS "Anon can read deals" ON public.deals;
CREATE POLICY "Auth can read deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update deals" ON public.deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can read deals" ON public.deals FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 4. Contracts (with lifecycle columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  buyer TEXT NOT NULL,
  price_per_tonne DECIMAL NOT NULL,
  is_active BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  payment_terms TEXT DEFAULT 'prepaid',
  incoterm TEXT DEFAULT 'FOB',
  auto_renew BOOLEAN DEFAULT false,
  termination_notice_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read contracts" ON public.contracts;
DROP POLICY IF EXISTS "GM can manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "GM can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anon can read contracts" ON public.contracts;
CREATE POLICY "Auth can read contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "GM can manage contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gm'));
CREATE POLICY "GM can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gm'));
CREATE POLICY "Anon can read contracts" ON public.contracts FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 5. Contract volumes (monthly planned vs actual + invoicing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id),
  month DATE NOT NULL,
  planned_volume DECIMAL NOT NULL,
  actual_volume DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'planned',
  invoice_number TEXT,
  invoice_status TEXT DEFAULT 'pending',
  payment_date DATE,
  UNIQUE(contract_id, month)
);
ALTER TABLE public.contract_volumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read contract_volumes" ON public.contract_volumes;
DROP POLICY IF EXISTS "Auth can insert volumes" ON public.contract_volumes;
DROP POLICY IF EXISTS "Auth can update volumes" ON public.contract_volumes;
DROP POLICY IF EXISTS "Anon can read contract_volumes" ON public.contract_volumes;
CREATE POLICY "Auth can read contract_volumes" ON public.contract_volumes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert volumes" ON public.contract_volumes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update volumes" ON public.contract_volumes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can read contract_volumes" ON public.contract_volumes FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 6. Production plan
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  target_output DECIMAL NOT NULL,
  actual_output DECIMAL DEFAULT 0,
  b100_output DECIMAL,
  glycerin_output DECIMAL,
  uco_consumed DECIMAL,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.production_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read production_plan" ON public.production_plan;
DROP POLICY IF EXISTS "Auth can insert production_plan" ON public.production_plan;
DROP POLICY IF EXISTS "Auth can update production_plan" ON public.production_plan;
DROP POLICY IF EXISTS "Anon can read production_plan" ON public.production_plan;
CREATE POLICY "Auth can read production_plan" ON public.production_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert production_plan" ON public.production_plan FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update production_plan" ON public.production_plan FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can read production_plan" ON public.production_plan FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 7. Stock levels
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  month DATE NOT NULL,
  opening_stock DECIMAL NOT NULL,
  produced DECIMAL DEFAULT 0,
  purchased DECIMAL DEFAULT 0,
  delivered DECIMAL DEFAULT 0,
  closing_stock DECIMAL,
  safety_stock_level DECIMAL DEFAULT 20,
  is_below_safety BOOLEAN DEFAULT false,
  UNIQUE(product, month)
);
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read stock_levels" ON public.stock_levels;
DROP POLICY IF EXISTS "Auth can insert stock_levels" ON public.stock_levels;
DROP POLICY IF EXISTS "Auth can update stock_levels" ON public.stock_levels;
DROP POLICY IF EXISTS "Anon can read stock_levels" ON public.stock_levels;
CREATE POLICY "Auth can read stock_levels" ON public.stock_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert stock_levels" ON public.stock_levels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update stock_levels" ON public.stock_levels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can read stock_levels" ON public.stock_levels FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 8. Prices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_type TEXT NOT NULL,
  value DECIMAL NOT NULL,
  effective_date DATE NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read prices" ON public.prices;
DROP POLICY IF EXISTS "Auth can insert prices" ON public.prices;
DROP POLICY IF EXISTS "Auth can update prices" ON public.prices;
DROP POLICY IF EXISTS "Anon can read prices" ON public.prices;
CREATE POLICY "Auth can read prices" ON public.prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert prices" ON public.prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update prices" ON public.prices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can read prices" ON public.prices FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 9. Monthly forecast (financial model)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  total_committed DECIMAL,
  avg_contract_price DECIMAL,
  barka_output DECIMAL,
  b100_produced DECIMAL,
  glycerin_produced DECIMAL,
  opening_stock DECIMAL,
  closing_stock DECIMAL,
  stock_warning BOOLEAN DEFAULT false,
  gap DECIMAL,
  arb_required DECIMAL,
  arb_capped DECIMAL,
  shortfall DECIMAL,
  production_revenue DECIMAL,
  production_cogs DECIMAL,
  production_profit DECIMAL,
  arb_revenue DECIMAL,
  arb_cost DECIMAL,
  arb_profit DECIMAL,
  total_profit DECIMAL,
  working_capital_needed DECIMAL,
  uco_needed DECIMAL,
  calculated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.monthly_forecast ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read monthly_forecast" ON public.monthly_forecast;
DROP POLICY IF EXISTS "Anon can read monthly_forecast" ON public.monthly_forecast;
CREATE POLICY "Auth can read monthly_forecast" ON public.monthly_forecast FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can read monthly_forecast" ON public.monthly_forecast FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 10. Finance exports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  export_type TEXT NOT NULL,
  data JSONB NOT NULL,
  exported_by UUID REFERENCES auth.users(id),
  exported_at TIMESTAMPTZ DEFAULT now(),
  sent_to_finance BOOLEAN DEFAULT false,
  finance_acknowledged BOOLEAN DEFAULT false
);
ALTER TABLE public.finance_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read finance_exports" ON public.finance_exports;
DROP POLICY IF EXISTS "Auth can insert exports" ON public.finance_exports;
CREATE POLICY "Auth can read finance_exports" ON public.finance_exports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert exports" ON public.finance_exports FOR INSERT TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 11. Audit log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read audit_log" ON public.audit_log;
CREATE POLICY "Auth can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 12. Raw material orders (procurement)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.raw_material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  supplier TEXT DEFAULT '',
  quantity_kg DECIMAL NOT NULL,
  unit_price DECIMAL,
  lead_time_days INTEGER NOT NULL,
  order_date DATE,
  required_by DATE NOT NULL,
  expected_delivery DATE,
  actual_delivery DATE,
  status TEXT DEFAULT 'pending',
  linked_month DATE NOT NULL,
  auto_generated BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.raw_material_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read raw_material_orders" ON public.raw_material_orders;
DROP POLICY IF EXISTS "Auth can insert raw_material_orders" ON public.raw_material_orders;
DROP POLICY IF EXISTS "Auth can update raw_material_orders" ON public.raw_material_orders;
CREATE POLICY "Auth can read raw_material_orders" ON public.raw_material_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert raw_material_orders" ON public.raw_material_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update raw_material_orders" ON public.raw_material_orders FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 13. Production confirmations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id),
  status TEXT DEFAULT 'awaiting_confirmation',
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  production_month DATE,
  tonnage DECIMAL,
  materials_ordered BOOLEAN DEFAULT false,
  slot_reserved BOOLEAN DEFAULT false,
  issue_flag TEXT,
  issue_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.production_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read production_confirmations" ON public.production_confirmations;
DROP POLICY IF EXISTS "Auth can insert production_confirmations" ON public.production_confirmations;
DROP POLICY IF EXISTS "Auth can update production_confirmations" ON public.production_confirmations;
CREATE POLICY "Auth can read production_confirmations" ON public.production_confirmations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert production_confirmations" ON public.production_confirmations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update production_confirmations" ON public.production_confirmations FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 14. System alerts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read system_alerts" ON public.system_alerts;
DROP POLICY IF EXISTS "Auth can insert system_alerts" ON public.system_alerts;
DROP POLICY IF EXISTS "Auth can update system_alerts" ON public.system_alerts;
CREATE POLICY "Auth can read system_alerts" ON public.system_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert system_alerts" ON public.system_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update system_alerts" ON public.system_alerts FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 15. ISCC certificates (compliance)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iscc_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  certificate_number TEXT,
  scope TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'active',
  ghg_savings_percent DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.iscc_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read iscc_certificates" ON public.iscc_certificates;
DROP POLICY IF EXISTS "Auth can insert iscc_certificates" ON public.iscc_certificates;
DROP POLICY IF EXISTS "Auth can update iscc_certificates" ON public.iscc_certificates;
CREATE POLICY "Auth can read iscc_certificates" ON public.iscc_certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert iscc_certificates" ON public.iscc_certificates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update iscc_certificates" ON public.iscc_certificates FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 16. Inventory consumption (planned vs actual material use)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_month DATE NOT NULL,
  material TEXT NOT NULL,
  planned_kg DECIMAL NOT NULL DEFAULT 0,
  actual_kg DECIMAL NOT NULL DEFAULT 0,
  variance_kg DECIMAL GENERATED ALWAYS AS (actual_kg - planned_kg) STORED,
  variance_pct DECIMAL GENERATED ALWAYS AS (CASE WHEN planned_kg > 0 THEN ((actual_kg - planned_kg) / planned_kg) * 100 ELSE 0 END) STORED,
  production_batch_id TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.inventory_consumption ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read inventory_consumption" ON public.inventory_consumption;
DROP POLICY IF EXISTS "Auth can insert inventory_consumption" ON public.inventory_consumption;
DROP POLICY IF EXISTS "Auth can update inventory_consumption" ON public.inventory_consumption;
CREATE POLICY "Auth can read inventory_consumption" ON public.inventory_consumption FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert inventory_consumption" ON public.inventory_consumption FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update inventory_consumption" ON public.inventory_consumption FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 17. Production actuals (planned vs actual volume/revenue)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text,
  month text NOT NULL,
  planned_volume_tonnes numeric NOT NULL DEFAULT 0,
  actual_volume_tonnes numeric NOT NULL DEFAULT 0,
  volume_variance_tonnes numeric GENERATED ALWAYS AS (actual_volume_tonnes - planned_volume_tonnes) STORED,
  volume_variance_pct numeric GENERATED ALWAYS AS (CASE WHEN planned_volume_tonnes > 0 THEN ((actual_volume_tonnes - planned_volume_tonnes) / planned_volume_tonnes) * 100 ELSE 0 END) STORED,
  planned_revenue numeric NOT NULL DEFAULT 0,
  actual_revenue numeric NOT NULL DEFAULT 0,
  revenue_variance numeric GENERATED ALWAYS AS (actual_revenue - planned_revenue) STORED,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  recorded_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.production_actuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read production_actuals" ON public.production_actuals;
DROP POLICY IF EXISTS "Auth can insert production_actuals" ON public.production_actuals;
DROP POLICY IF EXISTS "Auth can update production_actuals" ON public.production_actuals;
CREATE POLICY "Auth can read production_actuals" ON public.production_actuals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert production_actuals" ON public.production_actuals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update production_actuals" ON public.production_actuals FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 18. Documents (+ storage bucket)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER DEFAULT 0,
  mime_type TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  version INTEGER DEFAULT 1
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read documents" ON public.documents;
DROP POLICY IF EXISTS "Auth can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Auth can update documents" ON public.documents;
CREATE POLICY "Auth can read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update documents" ON public.documents FOR UPDATE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('wakud-documents', 'wakud-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can read documents" ON storage.objects;
CREATE POLICY "Auth can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wakud-documents');
CREATE POLICY "Auth can read documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'wakud-documents');
CREATE POLICY "Public can read documents" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'wakud-documents');

-- ----------------------------------------------------------------------------
-- 19. Shipments (logistics)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id TEXT,
  contract_id TEXT,
  shipment_ref TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  origin TEXT DEFAULT 'Barka, Oman',
  destination TEXT,
  vessel_name TEXT,
  bill_of_lading_number TEXT,
  container_numbers TEXT[] DEFAULT '{}',
  departure_date DATE,
  eta_date DATE,
  actual_arrival_date DATE,
  tonnes_loaded DECIMAL DEFAULT 0,
  tonnes_delivered DECIMAL DEFAULT 0,
  freight_cost_usd DECIMAL DEFAULT 0,
  insurance_cost_usd DECIMAL DEFAULT 0,
  customs_status TEXT DEFAULT 'pending',
  incoterm TEXT DEFAULT 'FOB',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read shipments" ON public.shipments;
DROP POLICY IF EXISTS "Auth can insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Auth can update shipments" ON public.shipments;
CREATE POLICY "Auth can read shipments" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update shipments" ON public.shipments FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 20. Exchange rates (USD/OMR peg seeded — reference data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read exchange_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Auth can insert exchange_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Auth can update exchange_rates" ON public.exchange_rates;
CREATE POLICY "Auth can read exchange_rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert exchange_rates" ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update exchange_rates" ON public.exchange_rates FOR UPDATE TO authenticated USING (true);

INSERT INTO public.exchange_rates (from_currency, to_currency, rate, effective_date, source)
SELECT 'USD', 'OMR', 0.385, CURRENT_DATE, 'fixed_peg'
WHERE NOT EXISTS (
  SELECT 1 FROM public.exchange_rates WHERE from_currency = 'USD' AND to_currency = 'OMR'
);

-- ----------------------------------------------------------------------------
-- 21. Quality tests (biodiesel QC panel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quality_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_batch_id TEXT,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tested_by TEXT,
  density_at_15c NUMERIC,
  viscosity_at_40c NUMERIC,
  flash_point NUMERIC,
  sulfur_content NUMERIC,
  water_content NUMERIC,
  acid_value NUMERIC,
  methanol_content NUMERIC,
  oxidation_stability NUMERIC,
  cloud_point NUMERIC,
  cetane_number NUMERIC,
  overall_result TEXT DEFAULT 'pending',
  notes TEXT,
  certificate_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quality_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read quality_tests" ON public.quality_tests;
DROP POLICY IF EXISTS "Auth can insert quality_tests" ON public.quality_tests;
DROP POLICY IF EXISTS "Auth can update quality_tests" ON public.quality_tests;
CREATE POLICY "Auth can read quality_tests" ON public.quality_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert quality_tests" ON public.quality_tests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update quality_tests" ON public.quality_tests FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 22. Invoices (USD with generated OMR amount)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  deal_id TEXT,
  buyer TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  amount_omr NUMERIC GENERATED ALWAYS AS (amount_usd * 0.385) STORED,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Auth can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Auth can update invoices" ON public.invoices;
CREATE POLICY "Auth can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 23. Maintenance schedule
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_name TEXT NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'Preventive',
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  assigned_to TEXT,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read maintenance_schedule" ON public.maintenance_schedule;
DROP POLICY IF EXISTS "Auth can insert maintenance_schedule" ON public.maintenance_schedule;
DROP POLICY IF EXISTS "Auth can update maintenance_schedule" ON public.maintenance_schedule;
CREATE POLICY "Auth can read maintenance_schedule" ON public.maintenance_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert maintenance_schedule" ON public.maintenance_schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update maintenance_schedule" ON public.maintenance_schedule FOR UPDATE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 24. Price feeds (commodity price history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commodity TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  price_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.price_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can read price_feeds" ON public.price_feeds;
DROP POLICY IF EXISTS "Auth can insert price_feeds" ON public.price_feeds;
DROP POLICY IF EXISTS "Auth can update price_feeds" ON public.price_feeds;
DROP POLICY IF EXISTS "Anon can read price_feeds" ON public.price_feeds;
CREATE POLICY "Auth can read price_feeds" ON public.price_feeds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert price_feeds" ON public.price_feeds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update price_feeds" ON public.price_feeds FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can read price_feeds" ON public.price_feeds FOR SELECT TO anon USING (true);

-- NOTE: The original project seeded 30 days of RANDOM demo prices here.
-- That has been intentionally removed so you start with real data.
-- Enter real commodity prices via the app, or import them.

-- ============================================================================
-- DONE. Next: create your users in Authentication, then assign their roles
-- (see the setup checklist for the exact steps).
-- ============================================================================
