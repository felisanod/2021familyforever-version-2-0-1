-- ============================================================
-- 2021familyforever — Complete Database Schema (Supabase / PostgreSQL)
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles ---------------------------------------------------
create table if not exists public.profiles (
  user_id uuid references auth.users on delete cascade primary key,
  phone_number text unique not null,
  full_name text not null,
  region text default '',
  city text default '',
  profile_picture text,
  role text not null default 'MEMBER' check (role in ('MEMBER', 'ADMIN')),
  -- PENDING = self-registered, awaiting admin approval
  account_status text not null default 'PENDING' check (account_status in ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Contributions ----------------------------------------------
create table if not exists public.contributions (
  contribution_id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  amount numeric not null check (amount > 0),
  opening_date date not null,
  due_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  created_by uuid references auth.users not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Payments ----------------------------------------------------
create table if not exists public.payments (
  payment_id uuid primary key default uuid_generate_v4(),
  member_id uuid references auth.users not null,
  contribution_id uuid references public.contributions on delete cascade not null,
  amount numeric not null check (amount > 0),
  payment_status text not null default 'PENDING' check (payment_status in ('PAID', 'PENDING', 'UNPAID')),
  payment_date date,
  payment_method text,
  transaction_reference text,
  recorded_by uuid references auth.users,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
-- Members may make MULTIPLE payments toward the same contribution;
-- status is derived dynamically from SUM(payments.amount).

-- Announcements ----------------------------------------------
create table if not exists public.announcements (
  announcement_id uuid primary key default uuid_generate_v4(),
  title text not null,
  message text not null,
  image_url text,
  attachment_url text,
  created_by uuid references auth.users not null,
  audience_type text not null default 'ALL' check (audience_type in ('ALL', 'SELECTED', 'REGION')),
  audience_region text,
  audience_city text,
  published_at timestamptz,
  expires_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'EXPIRED')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Announcement recipients (targeted audiences) ----------------
create table if not exists public.announcement_recipients (
  announcement_id uuid references public.announcements on delete cascade not null,
  member_id uuid references auth.users on delete cascade not null,
  primary key (announcement_id, member_id)
);
create index if not exists idx_announcement_recipients_member on public.announcement_recipients (member_id);

-- Notifications ----------------------------------------------
create table if not exists public.notifications (
  notification_id uuid primary key default uuid_generate_v4(),
  member_id uuid references auth.users on delete cascade not null,
  type text not null default 'SYSTEM' check (type in ('ANNOUNCEMENT', 'CONTRIBUTION', 'PAYMENT', 'ACCOUNT', 'SYSTEM')),
  title text not null,
  message text not null,
  related_id text,
  is_read boolean not null default false,
  created_at timestamptz default now() not null
);
create index if not exists idx_notifications_member on public.notifications (member_id, is_read, created_at desc);

-- Device tokens (push) ----------------------------------------
create table if not exists public.device_tokens (
  device_token_id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  push_token text not null,
  platform text not null default 'web',
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, push_token)
);

-- ============================================================
-- updated_at TOUCH TRIGGERS
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['profiles','contributions','payments','announcements','device_tokens'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute procedure public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Is the current user an admin? -------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'ADMIN' and account_status = 'ACTIVE'
  );
$$;

-- New auth user -> auto-create profile -------------------------
-- Email convention: <phone>@2021familyforever.local
-- Self-signups start as PENDING until an admin approves them.
-- Seeded admins (role metadata = ADMIN) are created ACTIVE directly.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, phone_number, full_name, region, city, role, account_status)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'phone_number', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce(new.raw_user_meta_data->>'region', ''),
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(new.raw_user_meta_data->>'role', 'MEMBER'),
    case when coalesce(new.raw_user_meta_data->>'role', 'MEMBER') = 'ADMIN' then 'ACTIVE' else 'PENDING' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Protect sensitive profile columns from self-service edits ----
create or replace function public.guard_profile_update()
returns trigger as $$
begin
  if not public.is_admin() then
    if new.role <> old.role or new.account_status <> old.account_status then
      raise exception 'Only administrators can change role or account status';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before update on public.profiles
  for each row execute procedure public.guard_profile_update();

-- ============================================================
-- CORE BUSINESS FUNCTIONS (security definer — backend authority)
-- ============================================================

-- Record a payment for a member against a contribution --------
create or replace function public.record_payment(
  p_member_id uuid,
  p_contribution_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_payment_method text default null,
  p_transaction_reference text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_payment_id uuid;
  v_contribution record;
  v_member record;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can record payments';
  end if;

  select * into v_contribution from public.contributions where contribution_id = p_contribution_id;
  if not found then
    raise exception 'Contribution not found';
  end if;
  if v_contribution.status <> 'OPEN' then
    raise exception 'This contribution is closed. New payments are no longer accepted.';
  end if;

  select * into v_member from public.profiles where user_id = p_member_id;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_member.account_status <> 'ACTIVE' then
    raise exception 'Member account is not active';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  -- Every payment is a separate transaction row; totals are aggregated in
  -- v_member_contribution_status to derive Partially Completed / Completed.
  insert into public.payments (
    member_id, contribution_id, amount, payment_status,
    payment_date, payment_method, transaction_reference, recorded_by
  ) values (
    p_member_id, p_contribution_id, p_amount, 'PAID',
    coalesce(p_payment_date, current_date), p_payment_method, p_transaction_reference, auth.uid()
  )
  returning payment_id into v_payment_id;

  insert into public.notifications (member_id, type, title, message, related_id)
  values (
    p_member_id, 'PAYMENT',
    'Payment Recorded',
    format('Your payment of TZS %s for "%s" was recorded successfully.',
           to_char(p_amount, 'FM999,999,999'), v_contribution.title),
    p_contribution_id::text
  );

  return v_payment_id;
end;
$$;

-- Close a contribution ----------------------------------------
create or replace function public.close_contribution(p_contribution_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_contribution record;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can close contributions';
  end if;

  select * into v_contribution from public.contributions where contribution_id = p_contribution_id for update;
  if not found then
    raise exception 'Contribution not found';
  end if;
  if v_contribution.status = 'CLOSED' then
    raise exception 'Contribution is already closed';
  end if;

  update public.contributions set status = 'CLOSED', updated_at = now()
  where contribution_id = p_contribution_id;

  -- Notify active members who have NOT paid (they are now UNPAID)
  for r in
    select p.user_id
    from public.profiles p
    where p.account_status = 'ACTIVE'
      and not exists (
        select 1 from public.payments pay
        where pay.member_id = p.user_id
          and pay.contribution_id = p_contribution_id
          and pay.payment_status = 'PAID'
      )
  loop
    insert into public.notifications (member_id, type, title, message, related_id)
    values (
      r.user_id, 'CONTRIBUTION',
      'Contribution Closed',
      format('"%s" is now closed. Members without a recorded payment are marked unpaid.', v_contribution.title),
      p_contribution_id::text
    );
  end loop;
end;
$$;

-- Publish an announcement + fan out notifications -------------
create or replace function public.publish_announcement(
  p_title text,
  p_message text,
  p_image_url text default null,
  p_attachment_url text default null,
  p_audience_type text default 'ALL',
  p_audience_region text default null,
  p_audience_city text default null,
  p_expires_at timestamptz default null,
  p_selected_members uuid[] default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_announcement_id uuid;
  v_count int := 0;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can publish announcements';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'Message is required';
  end if;

  insert into public.announcements (
    title, message, image_url, attachment_url, created_by,
    audience_type, audience_region, audience_city,
    published_at, expires_at, status
  ) values (
    trim(p_title), trim(p_message), p_image_url, p_attachment_url, auth.uid(),
    p_audience_type, p_audience_region, p_audience_city,
    now(), p_expires_at, 'PUBLISHED'
  )
  returning announcement_id into v_announcement_id;

  if p_audience_type = 'ALL' then
    insert into public.announcement_recipients (announcement_id, member_id)
    select v_announcement_id, p.user_id from public.profiles p where p.account_status = 'ACTIVE'
    on conflict do nothing;
  elsif p_audience_type = 'REGION' then
    insert into public.announcement_recipients (announcement_id, member_id)
    select v_announcement_id, p.user_id from public.profiles p
    where p.account_status = 'ACTIVE'
      and lower(trim(p.region)) = lower(trim(coalesce(p_audience_region, '')))
      and (p_audience_city is null or p_audience_city = '' or lower(trim(p.city)) = lower(trim(p_audience_city)))
    on conflict do nothing;
  elsif p_audience_type = 'SELECTED' then
    if p_selected_members is null or array_length(p_selected_members, 1) = 0 then
      raise exception 'Selected members list cannot be empty';
    end if;
    insert into public.announcement_recipients (announcement_id, member_id)
    select v_announcement_id, m from unnest(p_selected_members) m
    on conflict do nothing;
  else
    raise exception 'Invalid audience type';
  end if;

  -- Fan out notifications
  for r in
    select ar.member_id from public.announcement_recipients ar
    where ar.announcement_id = v_announcement_id
  loop
    insert into public.notifications (member_id, type, title, message, related_id)
    values (
      r.member_id, 'ANNOUNCEMENT',
      'New Announcement',
      format('%s — %s', trim(p_title), left(trim(p_message), 120)),
      v_announcement_id::text
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('announcement_id', v_announcement_id, 'recipients', v_count);
end;
$$;

-- Admin: change member account status + notify -----------------
create or replace function public.admin_set_member_status(p_member_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can manage accounts';
  end if;
  if p_status not in ('PENDING','ACTIVE','SUSPENDED','DELETED') then
    raise exception 'Invalid account status';
  end if;
  select account_status into v_old from public.profiles where user_id = p_member_id;
  if not found then raise exception 'Member not found'; end if;
  update public.profiles set account_status = p_status where user_id = p_member_id;
  if p_status <> v_old then
    insert into public.notifications (member_id, type, title, message, related_id)
    values (
      p_member_id, 'ACCOUNT',
      case when p_status = 'ACTIVE' and v_old = 'PENDING' then 'Account Approved'
           when p_status = 'SUSPENDED' then 'Account Suspended'
           when p_status = 'DELETED' then 'Account Unavailable'
           else 'Account Reactivated' end,
      case when p_status = 'ACTIVE' and v_old = 'PENDING' then 'Akaunti yako imedhinishwa. Karibu 2021familyforever! Sasa unaweza kuingia.'
           when p_status = 'SUSPENDED' then 'Your account has been suspended. Please contact an administrator.'
           when p_status = 'DELETED' then 'Your account is no longer active.'
           else 'Your account has been reactivated. Welcome back!' end,
      null
    );
  end if;
end;
$$;

-- Mark all of my notifications read ---------------------------
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.notifications set is_read = true where member_id = auth.uid() and is_read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Member contribution overview (authoritative dynamic status) --
-- Derived from TOTAL paid vs required amount:
--   PENDING   = open contribution, nothing paid yet
--   UNPAID    = closed contribution, nothing paid
--   PARTIAL   = 0 < total paid < required  (Partially Completed)
--   COMPLETED = total paid >= required     (overpay preserved)
drop view if exists public.v_member_contribution_status;
create view public.v_member_contribution_status
with (security_invoker = true) as
select
  c.contribution_id,
  c.title,
  c.description,
  c.amount as required_amount,
  c.opening_date,
  c.due_date,
  c.status as contribution_status,
  p.user_id as member_id,
  coalesce(t.total_paid, 0)::numeric as total_paid,
  greatest(c.amount - coalesce(t.total_paid, 0), 0)::numeric as remaining_amount,
  greatest(coalesce(t.total_paid, 0) - c.amount, 0)::numeric as overpaid_amount,
  least(round(coalesce(t.total_paid, 0) / c.amount * 100), 100)::int as progress_percent,
  case
    when coalesce(t.total_paid, 0) <= 0 then
      case when c.status = 'OPEN' then 'PENDING' else 'UNPAID' end
    when coalesce(t.total_paid, 0) < c.amount then 'PARTIAL'
    else 'COMPLETED'
  end as payment_status,
  t.last_payment_date,
  coalesce(t.payment_count, 0)::int as payment_count
from public.contributions c
cross join public.profiles p
left join (
  select pay.member_id,
         pay.contribution_id,
         sum(pay.amount) as total_paid,
         max(pay.payment_date) as last_payment_date,
         count(*) as payment_count
  from public.payments pay
  where pay.payment_status = 'PAID'
  group by pay.member_id, pay.contribution_id
) t on t.contribution_id = c.contribution_id and t.member_id = p.user_id
where p.account_status = 'ACTIVE';

-- ============================================================
-- MIGRATIONS FOR PRE-EXISTING INSTALLS (idempotent)
-- ============================================================
alter table public.announcements add column if not exists attachment_url text;
alter table public.announcements add column if not exists audience_region text;
alter table public.announcements add column if not exists audience_city text;

-- Remove any legacy record_payment overload from earlier iterations that
-- would create ambiguous function resolution for PostgREST.
drop function if exists public.record_payment(uuid, uuid, numeric, text, text, text);

do $$
begin
  -- Multiple payments per member per contribution are allowed — drop any
  -- legacy one-payment-per-contribution constraint.
  if exists (
    select 1 from pg_constraint where conname = 'payments_member_contribution_unique'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments drop constraint payments_member_contribution_unique;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'device_tokens_user_push_unique'
      and conrelid = 'public.device_tokens'::regclass
  ) then
    alter table public.device_tokens add constraint device_tokens_user_push_unique unique (user_id, push_token);
  end if;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.contributions enable row level security;
alter table public.payments enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.notifications enable row level security;
alter table public.device_tokens enable row level security;

-- Profiles -----------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  using (
    auth.uid() = user_id
    or public.is_admin()
    or account_status = 'ACTIVE'  -- members can see the family directory
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles for insert
  with check (public.is_admin());

-- Contributions -------------------------------------------------
drop policy if exists "contributions_select_authenticated" on public.contributions;
create policy "contributions_select_authenticated" on public.contributions for select
  using (auth.uid() is not null);

drop policy if exists "contributions_insert_admin" on public.contributions;
create policy "contributions_insert_admin" on public.contributions for insert
  with check (public.is_admin());

drop policy if exists "contributions_update_admin" on public.contributions;
create policy "contributions_update_admin" on public.contributions for update
  using (public.is_admin());

drop policy if exists "contributions_delete_admin" on public.contributions;
create policy "contributions_delete_admin" on public.contributions for delete
  using (public.is_admin());

-- Payments -------------------------------------------------------
drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin" on public.payments for select
  using (auth.uid() = member_id or public.is_admin());

drop policy if exists "payments_insert_via_rpc" on public.payments;
create policy "payments_insert_via_rpc" on public.payments for insert
  with check (false); -- inserts go through record_payment()

drop policy if exists "payments_update_admin" on public.payments;
create policy "payments_update_admin" on public.payments for update
  using (public.is_admin());

-- Announcements ---------------------------------------------------
drop policy if exists "announcements_select_visible" on public.announcements;
create policy "announcements_select_visible" on public.announcements for select
  using (
    public.is_admin()
    or (
      status = 'PUBLISHED'
      and (
        audience_type = 'ALL'
        or exists (
          select 1 from public.announcement_recipients ar
          where ar.announcement_id = announcements.announcement_id
            and ar.member_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "announcements_insert_admin" on public.announcements;
create policy "announcements_insert_admin" on public.announcements for insert
  with check (public.is_admin());

drop policy if exists "announcements_update_admin" on public.announcements;
create policy "announcements_update_admin" on public.announcements for update
  using (public.is_admin());

drop policy if exists "announcements_delete_admin" on public.announcements;
create policy "announcements_delete_admin" on public.announcements for delete
  using (public.is_admin());

-- Announcement recipients ------------------------------------------
drop policy if exists "recipients_select_own_or_admin" on public.announcement_recipients;
create policy "recipients_select_own_or_admin" on public.announcement_recipients for select
  using (auth.uid() = member_id or public.is_admin());

drop policy if exists "recipients_insert_admin" on public.announcement_recipients;
create policy "recipients_insert_admin" on public.announcement_recipients for insert
  with check (public.is_admin());

-- Notifications ------------------------------------------------------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select
  using (auth.uid() = member_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update
  using (auth.uid() = member_id);

drop policy if exists "notifications_insert_via_rpc" on public.notifications;
create policy "notifications_insert_via_rpc" on public.notifications for insert
  with check (false); -- inserts happen inside security definer functions

-- Device tokens -------------------------------------------------------
drop policy if exists "device_tokens_own_all" on public.device_tokens;
create policy "device_tokens_own_all" on public.device_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- View permission ------------------------------------------------------
grant select on public.v_member_contribution_status to authenticated;

-- ============================================================
-- STORAGE
-- ============================================================
insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

drop policy if exists "profile_pictures_public_read" on storage.objects;
create policy "profile_pictures_public_read" on storage.objects for select
  using (bucket_id = 'profile-pictures');

drop policy if exists "profile_pictures_owner_write" on storage.objects;
create policy "profile_pictures_owner_write" on storage.objects for insert
  with check (bucket_id = 'profile-pictures' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "profile_pictures_owner_update" on storage.objects;
create policy "profile_pictures_owner_update" on storage.objects for update
  using (bucket_id = 'profile-pictures' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "announcement_images_public_read" on storage.objects;
create policy "announcement_images_public_read" on storage.objects for select
  using (bucket_id = 'announcement-images');

drop policy if exists "announcement_images_admin_write" on storage.objects;
create policy "announcement_images_admin_write" on storage.objects for insert
  with check (bucket_id = 'announcement-images' and public.is_admin());

drop policy if exists "announcement_images_admin_update" on storage.objects;
create policy "announcement_images_admin_update" on storage.objects for update
  using (bucket_id = 'announcement-images' and public.is_admin());

drop policy if exists "announcement_images_admin_delete" on storage.objects;
create policy "announcement_images_admin_delete" on storage.objects for delete
  using (bucket_id = 'announcement-images' and public.is_admin());

-- ============================================================
-- REALTIME
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['notifications','announcements','contributions','payments','profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;