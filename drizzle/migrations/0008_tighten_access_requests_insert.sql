DROP POLICY IF EXISTS "Anyone can request access" ON public.access_requests;

CREATE POLICY "Anyone can request access"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 3 AND 320
  AND position('@' IN email) > 1
);