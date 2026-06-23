-- Migration 044: Alpro Pillar incentives (Phase 2)
-- Reward tiers (category x T1/T2/T3 matrix), revenue targets CSV upload,
-- self-reported monthly Revenue/Focus Product %, and Incentive 1 fields
-- on templates/assignments.

-- ============================================================
-- INCENTIVE 1 FIELDS — flat or per-pax reward for completing a pillar
-- ============================================================

ALTER TABLE public.pillar_templates
  ADD COLUMN IF NOT EXISTS incentive1_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive1_basis text NOT NULL DEFAULT 'per_outlet' CHECK (incentive1_basis IN ('per_outlet','per_pax'));

ALTER TABLE public.pillar_assignments
  ADD COLUMN IF NOT EXISTS incentive1_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive1_basis text NOT NULL DEFAULT 'per_outlet' CHECK (incentive1_basis IN ('per_outlet','per_pax'));

-- ============================================================
-- REWARD TIERS — Category x Tier-hit matrix (per-pax amounts)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pillar_reward_tiers (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN ('bronze','silver','gold','platinum','titanium')),
  revenue_min  numeric NOT NULL DEFAULT 0,
  revenue_max  numeric, -- null = open-ended (top category)
  t1_reward    numeric NOT NULL DEFAULT 0,
  t2_reward    numeric NOT NULL DEFAULT 0,
  t3_reward    numeric NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, category)
);

CREATE OR REPLACE FUNCTION public.update_pillar_reward_tier_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_reward_tier_updated_at BEFORE UPDATE ON public.pillar_reward_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_reward_tier_updated_at();

-- Seed default matrix (IDR) for every existing org, skipped if already present
INSERT INTO public.pillar_reward_tiers (org_id, category, revenue_min, revenue_max, t1_reward, t2_reward, t3_reward)
SELECT o.id, v.category, v.revenue_min, v.revenue_max, v.t1_reward, v.t2_reward, v.t3_reward
FROM public.organizations o
CROSS JOIN (VALUES
  ('bronze',    0,           150000000, 200000, 300000,  500000),
  ('silver',    150000000,   350000000, 250000, 350000,  600000),
  ('gold',      350000000,   550000000, 300000, 450000,  750000),
  ('platinum',  550000000,   750000000, 400000, 600000,  950000),
  ('titanium',  750000000,   1000000000, 500000, 750000, 1200000)
) AS v(category, revenue_min, revenue_max, t1_reward, t2_reward, t3_reward)
ON CONFLICT (org_id, category) DO NOTHING;

-- ============================================================
-- TARGETS — CSV-uploaded outlet revenue targets per month
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pillar_targets (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id    uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  outlet_code  text NOT NULL,
  outlet_name  text,
  category     text NOT NULL CHECK (category IN ('bronze','silver','gold','platinum','titanium')),
  month        date NOT NULL, -- normalized to first day of month
  t1           numeric NOT NULL DEFAULT 0,
  t2           numeric NOT NULL DEFAULT 0,
  t3           numeric NOT NULL DEFAULT 0,
  uploaded_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, outlet_code, month)
);

CREATE INDEX IF NOT EXISTS pillar_targets_org_id_idx ON public.pillar_targets(org_id);
CREATE INDEX IF NOT EXISTS pillar_targets_outlet_id_idx ON public.pillar_targets(outlet_id);
CREATE INDEX IF NOT EXISTS pillar_targets_month_idx ON public.pillar_targets(month);

CREATE OR REPLACE FUNCTION public.update_pillar_target_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_target_updated_at BEFORE UPDATE ON public.pillar_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_target_updated_at();

-- ============================================================
-- MONTHLY INPUTS — self-reported Revenue + Focus Product % per outlet/month
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pillar_monthly_inputs (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id          uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  month              date NOT NULL, -- normalized to first day of month
  revenue            numeric NOT NULL DEFAULT 0,
  focus_product_pct  numeric NOT NULL DEFAULT 0,
  reported_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, month)
);

CREATE INDEX IF NOT EXISTS pillar_monthly_inputs_org_id_idx ON public.pillar_monthly_inputs(org_id);
CREATE INDEX IF NOT EXISTS pillar_monthly_inputs_outlet_id_idx ON public.pillar_monthly_inputs(outlet_id);
CREATE INDEX IF NOT EXISTS pillar_monthly_inputs_month_idx ON public.pillar_monthly_inputs(month);

CREATE OR REPLACE FUNCTION public.update_pillar_monthly_input_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_monthly_input_updated_at BEFORE UPDATE ON public.pillar_monthly_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_monthly_input_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.pillar_reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_monthly_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_pillar_reward_tiers" ON public.pillar_reward_tiers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_reward_tiers" ON public.pillar_reward_tiers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_targets" ON public.pillar_targets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_targets" ON public.pillar_targets FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_monthly_inputs" ON public.pillar_monthly_inputs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_monthly_inputs" ON public.pillar_monthly_inputs FOR ALL USING (auth.uid() IS NOT NULL);
