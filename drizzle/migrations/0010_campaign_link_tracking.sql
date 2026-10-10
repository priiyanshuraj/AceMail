CREATE TABLE public.email_tracking_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 log_id uuid NOT NULL REFERENCES public.email_logs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 destination text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(log_id, destination)
);
GRANT SELECT ON public.email_tracking_links TO authenticated;
GRANT ALL ON public.email_tracking_links TO service_role;
ALTER TABLE public.email_tracking_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read tracked links" ON public.email_tracking_links FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.email_click_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 link_id uuid NOT NULL REFERENCES public.email_tracking_links(id) ON DELETE CASCADE,
 log_id uuid NOT NULL REFERENCES public.email_logs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 clicked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_click_events TO authenticated;
GRANT ALL ON public.email_click_events TO service_role;
ALTER TABLE public.email_click_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read email clicks" ON public.email_click_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX email_click_events_log_time_idx ON public.email_click_events(log_id, clicked_at DESC);
CREATE INDEX email_tracking_links_log_idx ON public.email_tracking_links(log_id);
CREATE OR REPLACE FUNCTION public.campaign_analytics(_campaign_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH logs AS (SELECT * FROM public.email_logs WHERE campaign_id = _campaign_id AND user_id = auth.uid()),
clicks AS (SELECT e.* FROM public.email_click_events e JOIN logs l ON l.id=e.log_id),
replies AS (SELECT i.* FROM public.inbox_messages i WHERE i.campaign_id=_campaign_id AND i.user_id=auth.uid())
SELECT jsonb_build_object(
 'total', (SELECT count(*) FROM logs),
 'sent', (SELECT count(*) FROM logs WHERE sent_at IS NOT NULL),
 'opened', (SELECT count(*) FROM logs WHERE opened_at IS NOT NULL),
 'queued', (SELECT count(*) FROM logs WHERE status='queued'),
 'paused', (SELECT count(*) FROM logs WHERE status='paused'),
 'failed', (SELECT count(*) FROM logs WHERE status='failed'),
 'clicked', (SELECT count(DISTINCT log_id) FROM clicks),
 'clickEvents', (SELECT count(*) FROM clicks),
 'replied', (SELECT count(DISTINCT contact_id) FROM replies),
 'sentRecipients', (SELECT count(DISTINCT contact_id) FROM logs WHERE sent_at IS NOT NULL),
 'activity', coalesce((SELECT jsonb_agg(x ORDER BY x.at DESC) FROM (
 SELECT 'opened' AS kind, l.opened_at AS at, c.email AS recipient, NULL::text AS destination FROM logs l JOIN public.contacts c ON c.id=l.contact_id WHERE l.opened_at IS NOT NULL
 UNION ALL SELECT 'clicked', e.clicked_at, c.email, t.destination FROM clicks e JOIN logs l ON l.id=e.log_id JOIN public.contacts c ON c.id=l.contact_id JOIN public.email_tracking_links t ON t.id=e.link_id
 UNION ALL SELECT 'replied', r.received_at, r.from_email, NULL::text FROM replies r
 ORDER BY at DESC LIMIT 100) x), '[]'::jsonb)
); $$;
REVOKE ALL ON FUNCTION public.campaign_analytics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_analytics(uuid) TO authenticated;