-- Add RLS policies to allow signup/registration
-- These policies permit anonymous users to insert new users during signup

-- For users table - allow anonymous to insert during signup
CREATE POLICY "Anyone can create a user on signup" ON public.users
  FOR INSERT WITH CHECK (true);

-- For email_auth table - allow anonymous to insert during email signup
CREATE POLICY "Anyone can create email auth on signup" ON public.email_auth
  FOR INSERT WITH CHECK (true);

-- For passkey_credentials table - allow anonymous to insert during passkey registration
CREATE POLICY "Anyone can create passkey on registration" ON public.passkey_credentials
  FOR INSERT WITH CHECK (true);

-- For sessions table - allow anonymous to insert a session
CREATE POLICY "Anyone can create sessions on auth" ON public.sessions
  FOR INSERT WITH CHECK (true);
