-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- Create working_hours table
create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists working_hours_shop_day_idx
  on public.working_hours (shop_id, day_of_week);

-- Enforce max 2 barbers per shop via trigger
create or replace function public.enforce_max_two_barbers()
returns trigger as $$
begin
  if ( (select count(*) from public.barbers where shop_id = new.shop_id and deleted_at is null) >= 2 ) then
    raise exception 'Maximum 2 barbers per shop';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_max_two_barbers on public.barbers;
create trigger trg_enforce_max_two_barbers
before insert on public.barbers
for each row execute function public.enforce_max_two_barbers();

-- Basic RLS policies (require authentication, owner access)
alter table public.shops enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;

-- Assume auth.uid() is the owner_id for shops
create policy shops_owner_select on public.shops
  for select using (owner_id = auth.uid() and deleted_at is null);
create policy shops_owner_insert on public.shops
  for insert with check (owner_id = auth.uid());
create policy shops_owner_update on public.shops
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Barbers/services/working_hours scoped by shop ownership
create policy barbers_owner_all on public.barbers
  for all using (
    exists (
      select 1 from public.shops s where s.id = barbers.shop_id and s.owner_id = auth.uid() and s.deleted_at is null
    )
  ) with check (
    exists (
      select 1 from public.shops s where s.id = barbers.shop_id and s.owner_id = auth.uid() and s.deleted_at is null
    )
  );

create policy services_owner_all on public.services
  for all using (
    exists (
      select 1 from public.shops s where s.id = services.shop_id and s.owner_id = auth.uid() and s.deleted_at is null
    )
  ) with check (
    exists (
      select 1 from public.shops s where s.id = services.shop_id and s.owner_id = auth.uid() and s.deleted_at is null
    )
  );

create policy working_hours_owner_all on public.working_hours
  for all using (
    exists (
      select 1 from public.shops s where s.id = working_hours.shop_id and s.owner_id = auth.uid() and s.deleted_at is null
    )
  ) with check (
    exists (
      select 1 from public.shops s where s.id = working_hours.shop_id and s.owner_id = auth.uid() and s.deleted_at is null
    )
  );

-- Additional constraints for services
alter table public.services
  add constraint services_duration_positive check (duration_minutes > 0);
alter table public.services
  add constraint services_price_nonnegative check (price >= 0);
