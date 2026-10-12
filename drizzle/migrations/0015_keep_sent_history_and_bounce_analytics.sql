ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS recipient_email text;
UPDATE public.email_logs l SET recipient_email = c.email FROM public.contacts c WHERE c.id = l.contact_id AND l.recipient_email IS NULL;

ALTER TABLE public.email_logs DROP CONSTRAINT email_logs_contact_id_fkey;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Removing a contact drops its unsent emails but keeps sent history (bounces, opens) for stats.
CREATE OR REPLACE FUNCTION public.preserve_contact_email_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM public.email_logs WHERE contact_id = OLD.id AND sent_at IS NULL;
  UPDATE public.email_logs SET recipient_email = coalesce(recipient_email, OLD.email) WHERE contact_id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS contacts_preserve_email_history ON public.contacts;
CREATE TRIGGER contacts_preserve_email_history BEFORE DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.preserve_contact_email_history();

CREATE OR REPLACE FUNCTION public.campaign_analytics(_campaign_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
WITH logs AS (SELECT l.*, coalesce(c.email, l.recipient_email) AS to_email FROM public.email_logs l LEFT JOIN public.contacts c ON c.id = l.contact_id WHERE l.campaign_id = _campaign_id AND l.user_id = auth.uid()),
clicks AS (SELECT e.* FROM public.email_click_events e JOIN logs l ON l.id=e.log_id),
replies AS (SELECT i.* FROM public.inbox_messages i WHERE i.campaign_id=_campaign_id AND i.user_id=auth.uid())
SELECT jsonb_build_object(
 'total', (SELECT count(*) FROM logs),
 'sent', (SELECT count(*) FROM logs WHERE sent_at IS NOT NULL),
 'opened', (SELECT count(*) FROM logs WHERE opened_at IS NOT NULL AND status <> 'bounced'),
 'queued', (SELECT count(*) FROM logs WHERE status='queued'),
 'paused', (SELECT count(*) FROM logs WHERE status='paused'),
 'failed', (SELECT count(*) FROM logs WHERE status='failed'),
 'bounced', (SELECT count(*) FROM logs WHERE status='bounced'),
 'clicked', (SELECT count(DISTINCT log_id) FROM clicks),
 'clickEvents', (SELECT count(*) FROM clicks),
 'replied', (SELECT count(DISTINCT contact_id) FROM replies),
 'sentRecipients', (SELECT count(DISTINCT coalesce(contact_id::text, to_email)) FROM logs WHERE sent_at IS NOT NULL),
 'activity', coalesce((SELECT jsonb_agg(x ORDER BY x.at DESC) FROM (
 SELECT 'opened' AS kind, l.opened_at AS at, l.to_email AS recipient, NULL::text AS destination FROM logs l WHERE l.opened_at IS NOT NULL AND l.status <> 'bounced'
 UNION ALL SELECT 'clicked', e.clicked_at, l.to_email, t.destination FROM clicks e JOIN logs l ON l.id=e.log_id JOIN public.email_tracking_links t ON t.id=e.link_id
 UNION ALL SELECT 'replied', r.received_at, r.from_email, NULL::text FROM replies r
 ORDER BY at DESC LIMIT 100) x), '[]'::jsonb)
); $function$;