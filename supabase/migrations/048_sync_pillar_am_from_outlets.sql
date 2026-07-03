-- Sync pillar_assignments.area_manager_id to match current outlets.area_manager_id
UPDATE public.pillar_assignments pa
SET area_manager_id = o.area_manager_id,
    updated_at = now()
FROM public.outlets o
WHERE pa.outlet_id = o.id
  AND pa.area_manager_id IS DISTINCT FROM o.area_manager_id;

-- Create a trigger to keep pillar_assignments.area_manager_id in sync
-- whenever outlets.area_manager_id is updated
CREATE OR REPLACE FUNCTION public.trg_sync_pillar_am_from_outlet()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.area_manager_id IS DISTINCT FROM OLD.area_manager_id THEN
    UPDATE public.pillar_assignments
    SET area_manager_id = NEW.area_manager_id,
        updated_at = now()
    WHERE outlet_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outlet_am_sync ON public.outlets;
CREATE TRIGGER trg_outlet_am_sync
AFTER UPDATE OF area_manager_id ON public.outlets
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_pillar_am_from_outlet();
