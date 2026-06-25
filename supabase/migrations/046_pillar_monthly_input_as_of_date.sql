-- Track the date a monthly revenue/focus-product figure was reported as-of,
-- so progress can be linearly extrapolated to an end-of-month forecast.
ALTER TABLE public.pillar_monthly_inputs
  ADD COLUMN IF NOT EXISTS as_of_date date;
