
CREATE TABLE public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_payments_customer ON public.customer_payments(customer_id);
CREATE INDEX idx_customer_payments_created_at ON public.customer_payments(created_at DESC);

GRANT SELECT, INSERT ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view customer payments"
ON public.customer_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth create customer payments"
ON public.customer_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins delete customer payments"
ON public.customer_payments FOR DELETE TO authenticated
USING (is_admin(auth.uid()));
