ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
COMMENT ON COLUMN public.profiles.phone IS 'Optional customer contact phone; email remains canonical in Cloud Auth.';