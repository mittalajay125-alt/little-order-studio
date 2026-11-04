CREATE TABLE public.customer_login_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  browser_hash text NOT NULL,
  code_verifier text NOT NULL,
  auth_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','consumed','cancelled')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_login_requests_email_created_idx ON public.customer_login_requests (email, created_at DESC);
GRANT ALL ON public.customer_login_requests TO service_role;
ALTER TABLE public.customer_login_requests ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.customer_login_requests IS 'Private cross-device email approval requests; accessed only by server functions with the service role.';