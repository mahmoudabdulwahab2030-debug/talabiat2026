CREATE OR REPLACE FUNCTION public.track_upload_meta()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE who text;
BEGIN
  who := NEW.data->>'uploadedBy';
  IF TG_OP = 'INSERT' THEN
    IF who IS NOT NULL THEN NEW.data := NEW.data || jsonb_build_object('uploadedAt', now()); END IF;
    RETURN NEW;
  END IF;
  IF OLD.data ? 'uploadedBy' THEN
    NEW.data := NEW.data || jsonb_build_object('uploadedBy', OLD.data->'uploadedBy', 'uploadedAt', COALESCE(OLD.data->'uploadedAt', to_jsonb(OLD.created_at)));
  END IF;
  IF who IS NOT NULL THEN
    NEW.data := NEW.data || jsonb_build_object('modifiedBy', who, 'modifiedAt', now());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER orders_track_upload BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.track_upload_meta();
CREATE TRIGGER orders_best_sweet_track_upload BEFORE INSERT OR UPDATE ON public.orders_best_sweet FOR EACH ROW EXECUTE FUNCTION public.track_upload_meta();