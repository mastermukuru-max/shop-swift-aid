
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bulk_unit text,
  ADD COLUMN IF NOT EXISTS units_per_bulk numeric NOT NULL DEFAULT 1;
