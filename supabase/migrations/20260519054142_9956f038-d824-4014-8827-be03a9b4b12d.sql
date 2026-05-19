
-- Sequence for serial product codes
CREATE SEQUENCE IF NOT EXISTS public.product_serial_seq START 1;

-- Renumber existing products to 001, 002, ... by created_at
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.products
)
UPDATE public.products p
SET sku = LPAD(ordered.rn::text, 3, '0')
FROM ordered
WHERE p.id = ordered.id;

-- Advance sequence past the highest numeric SKU
SELECT setval('public.product_serial_seq',
  GREATEST(1, (SELECT COALESCE(MAX(sku::int), 0) FROM public.products WHERE sku ~ '^[0-9]+$')));

-- Trigger to auto-assign next serial when sku is null/blank
CREATE OR REPLACE FUNCTION public.assign_product_serial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
    NEW.sku := LPAD(nextval('public.product_serial_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_product_serial ON public.products;
CREATE TRIGGER trg_assign_product_serial
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.assign_product_serial();
