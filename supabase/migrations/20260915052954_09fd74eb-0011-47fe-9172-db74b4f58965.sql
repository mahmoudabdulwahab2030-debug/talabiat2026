CREATE TABLE public.whatsapp_files (
  id text PRIMARY KEY DEFAULT replace((gen_random_uuid())::text, '-', ''),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_files TO anon;
GRANT ALL ON public.whatsapp_files TO service_role;
ALTER TABLE public.whatsapp_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_files_open_access ON public.whatsapp_files FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX whatsapp_files_data_idx ON public.whatsapp_files USING gin (data);
CREATE INDEX whatsapp_files_created_idx ON public.whatsapp_files (created_at DESC);
CREATE TRIGGER set_whatsapp_files_updated_at BEFORE UPDATE ON public.whatsapp_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();