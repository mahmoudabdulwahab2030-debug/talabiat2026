CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $do$
DECLARE t text;
DECLARE names text[] := ARRAY[
  'orders','orders_best_sweet','drafts','send_orders',
  'catalog','products','materials','sections','suppliers','warehouses',
  'transfers','inbound','outbound','purchase_requests','requisitions','inventory_audit',
  'moled_items','moled_invoices',
  'app_users','invoices','reservations','chat_messages','chat_users','settings','counters',
  'urgent_news','suggestions','activity_logs','reports','branches','stock_movements'
];
BEGIN
  FOREACH t IN ARRAY names LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (
      id text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, ''-'', ''''),
      data jsonb NOT NULL DEFAULT ''{}''::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_open_access', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t || '_open_access', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING GIN (data)', t || '_data_gin', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_at DESC)', t || '_created_at_idx', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_set_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
  END LOOP;
END $do$;