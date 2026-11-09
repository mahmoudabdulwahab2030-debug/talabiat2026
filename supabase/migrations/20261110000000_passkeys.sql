-- الدخول بالبصمة / Face ID (Passkeys): مفاتيح عامة مرتبطة بالمستخدم، وتحديات مؤقتة لمرة واحدة
create table if not exists public.passkeys (
  credential_id text primary key,
  user_code text not null,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_code_idx on public.passkeys (user_code);

create table if not exists public.passkey_challenges (
  id uuid primary key,
  kind text not null check (kind in ('reg', 'auth')),
  user_code text,
  challenge text not null,
  expires_at timestamptz not null
);

-- الوصول لهذه الجداول من الخادم فقط (مفتاح الخدمة)
alter table public.passkeys enable row level security;
alter table public.passkey_challenges enable row level security;
