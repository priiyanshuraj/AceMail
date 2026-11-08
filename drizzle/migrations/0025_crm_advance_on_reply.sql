CREATE OR REPLACE FUNCTION public.crm_advance_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st record;
BEGIN
  IF NEW.contact_id IS NULL OR NEW.is_auto_reply THEN RETURN NEW; END IF;
  SELECT id, position INTO st FROM public.crm_stages
   WHERE user_id = NEW.user_id AND lower(name) = 'replied' LIMIT 1;
  IF st.id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.crm_deals d SET stage_id = st.id, updated_at = now()
   FROM public.crm_stages s
   WHERE d.stage_id = s.id AND d.user_id = NEW.user_id AND d.contact_id = NEW.contact_id
     AND s.position < st.position AND NOT s.is_won AND NOT s.is_lost;
  IF NOT EXISTS (SELECT 1 FROM public.crm_deals WHERE user_id = NEW.user_id AND contact_id = NEW.contact_id) THEN
    INSERT INTO public.crm_deals (user_id, contact_id, stage_id, title)
    VALUES (NEW.user_id, NEW.contact_id, st.id, 'Reply from ' || coalesce(nullif(NEW.from_name, ''), NEW.from_email));
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_advance_on_reply ON public.inbox_messages;
CREATE TRIGGER crm_advance_on_reply AFTER INSERT ON public.inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.crm_advance_on_reply();