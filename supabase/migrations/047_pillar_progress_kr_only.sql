-- Fix pillar progress to use KR-only average (ignore subtask completion)
CREATE OR REPLACE FUNCTION public.recalculate_pillar_progress(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  kr_avg numeric;
  kr_count integer;
  final_progress numeric;
BEGIN
  SELECT
    COALESCE(AVG(
      CASE
        WHEN metric_type = 'boolean' THEN (CASE WHEN current_value >= 1 THEN 100 ELSE 0 END)
        WHEN (target_value - start_value) = 0 THEN 0
        ELSE LEAST(100, GREATEST(0, ((current_value - start_value) / (target_value - start_value)) * 100))
      END
    ), 0),
    COUNT(*)
  INTO kr_avg, kr_count
  FROM public.pillar_assignment_krs
  WHERE assignment_id = p_assignment_id;

  final_progress := CASE
    WHEN kr_count > 0 THEN kr_avg
    ELSE 0
  END;

  UPDATE public.pillar_assignments
  SET progress = final_progress,
      status = CASE WHEN final_progress >= 100 THEN 'completed' WHEN status = 'completed' THEN 'in_progress' ELSE status END,
      updated_at = now()
  WHERE id = p_assignment_id;
END;
$$;

-- Recalculate all existing assignments
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.pillar_assignments LOOP
    PERFORM public.recalculate_pillar_progress(r.id);
  END LOOP;
END $$;
