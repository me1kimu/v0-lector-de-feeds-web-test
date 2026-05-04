-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  display_name TEXT,
  encryption_key_salt TEXT NOT NULL, -- Salt for deriving encryption keys
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Passkey credentials table
CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  credential_public_key TEXT NOT NULL, -- Base64 encoded
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g., ['usb', 'ble', 'internal']
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, credential_id)
);

-- Email authentication fallback
CREATE TABLE IF NOT EXISTS public.email_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Passkey challenges for WebAuthn flow
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL UNIQUE,
  challenge_type TEXT NOT NULL, -- 'registration' or 'authentication'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Feed sources
CREATE TABLE IF NOT EXISTS public.feed_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'rss', 'mastodon', 'bluesky', 'twitter', 'instagram'
  name TEXT NOT NULL,
  url TEXT,
  handle TEXT,
  refresh_interval INTEGER DEFAULT 3600, -- seconds
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Encrypted credentials for feed sources
CREATE TABLE IF NOT EXISTS public.encrypted_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.feed_sources(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- source type
  encrypted_data TEXT NOT NULL, -- NaCl secretbox encrypted JSON
  encryption_nonce TEXT NOT NULL,
  algorithm TEXT DEFAULT 'AES-256-GCM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Session tokens
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL, -- 'passkey' or 'email'
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for passkey_credentials
CREATE POLICY "Users can read own passkeys" ON public.passkey_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own passkeys" ON public.passkey_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own passkeys" ON public.passkey_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own passkeys" ON public.passkey_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for email_auth
CREATE POLICY "Users can read own email auth" ON public.email_auth
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email auth" ON public.email_auth
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for feed_sources
CREATE POLICY "Users can read own sources" ON public.feed_sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sources" ON public.feed_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sources" ON public.feed_sources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sources" ON public.feed_sources
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for encrypted_credentials
CREATE POLICY "Users can read own credentials" ON public.encrypted_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own credentials" ON public.encrypted_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON public.encrypted_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials" ON public.encrypted_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sessions
CREATE POLICY "Users can read own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_passkey_credentials_user_id ON public.passkey_credentials(user_id);
CREATE INDEX idx_passkey_credentials_credential_id ON public.passkey_credentials(credential_id);
CREATE INDEX idx_feed_sources_user_id ON public.feed_sources(user_id);
CREATE INDEX idx_encrypted_credentials_user_id ON public.encrypted_credentials(user_id);
CREATE INDEX idx_encrypted_credentials_source_id ON public.encrypted_credentials(source_id);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_passkey_challenges_expires_at ON public.passkey_challenges(expires_at);

-- Feed items (stores normalized feed entries)
CREATE TABLE IF NOT EXISTS public.feed_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.feed_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  content_html TEXT,
  source_type TEXT,
  source_name TEXT,
  author_name TEXT,
  author_url TEXT,
  item_url TEXT,
  media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  published_at TIMESTAMP WITH TIME ZONE,
  sync_hash TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (source_id, external_id)
);

-- Feed sync logs (records each sync run)
CREATE TABLE IF NOT EXISTS public.feed_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.feed_sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  items_fetched INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  error_code TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Allow 'pending' as initial state
ALTER TABLE public.feed_sync_logs
  ADD CONSTRAINT feed_sync_logs_status_check CHECK (status IN ('pending','success','partial','error','timeout'));

-- Enable RLS for the new tables
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for feed_items
CREATE POLICY "Users can read own feed items" ON public.feed_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed items" ON public.feed_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed items" ON public.feed_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed items" ON public.feed_items
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for feed_sync_logs
CREATE POLICY "Users can read own feed sync logs" ON public.feed_sync_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed sync logs" ON public.feed_sync_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed sync logs" ON public.feed_sync_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feed_items_user_id ON public.feed_items(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_source_id ON public.feed_items(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_external_id ON public.feed_items(external_id);

CREATE INDEX IF NOT EXISTS idx_feed_sync_logs_user_id ON public.feed_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_sync_logs_source_id ON public.feed_sync_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_sync_logs_status ON public.feed_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_feed_sync_logs_created_at ON public.feed_sync_logs(created_at);
