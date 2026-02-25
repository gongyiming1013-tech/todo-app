-- Run this in Supabase SQL Editor to enable cross-device voice settings sync.

create table if not exists public.user_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    region text not null default 'global',
    voice_provider text not null default 'openai',
    openai_api_key text not null default '',
    cn_stt_api_key text not null default '',
    cn_rewrite_api_key text not null default '',
    cn_base_url text not null default '',
    cn_stt_base_url text not null default '',
    cn_rewrite_base_url text not null default '',
    cn_stt_model text not null default 'whisper-1',
    cn_rewrite_model text not null default 'gpt-4o-mini',
    language text not null default 'auto',
    external_app_url text not null default '',
    updated_at timestamptz not null default now()
);

alter table public.user_settings add column if not exists region text not null default 'global';
alter table public.user_settings add column if not exists cn_stt_api_key text not null default '';
alter table public.user_settings add column if not exists cn_rewrite_api_key text not null default '';
alter table public.user_settings add column if not exists cn_base_url text not null default '';
alter table public.user_settings add column if not exists cn_stt_base_url text not null default '';
alter table public.user_settings add column if not exists cn_rewrite_base_url text not null default '';
alter table public.user_settings add column if not exists cn_stt_model text not null default 'whisper-1';
alter table public.user_settings add column if not exists cn_rewrite_model text not null default 'gpt-4o-mini';

alter table public.user_settings enable row level security;

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
on public.user_settings
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
on public.user_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
