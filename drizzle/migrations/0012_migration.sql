ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_status_check CHECK (status = ANY (ARRAY['queued','sent','failed','opened','replied','skipped','bounced']));
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS bounced_at timestamptz;