create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (length(full_name) <= 80),
 default_address_id uuid,
 updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "customers read own profile" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "customers create own profile" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "customers update own profile" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.customer_addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 label text not null check (length(trim(label)) between 1 and 40),
 full_name text not null check (length(trim(full_name)) between 2 and 80),
 phone text not null check (phone ~ '^\+?[0-9]{10,13}$'),
 house text not null check (length(trim(house)) between 1 and 100),
 street text not null check (length(trim(street)) between 1 and 150),
 area text not null check (length(trim(area)) between 1 and 100),
 city text not null check (length(trim(city)) between 1 and 80),
 state text not null check (length(trim(state)) between 1 and 80),
 pin text not null check (pin ~ '^[1-9][0-9]{5}$'),
 landmark text not null default '' check (length(landmark) <= 150),
 latitude double precision check (latitude between -90 and 90),
 longitude double precision check (longitude between -180 and 180),
 created_at timestamptz not null default now(),
 unique (user_id, id)
);
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant all on public.customer_addresses to service_role;
alter table public.customer_addresses enable row level security;
create policy "customers manage own addresses" on public.customer_addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.profiles add constraint profiles_default_address_owner foreign key (user_id, default_address_id) references public.customer_addresses(user_id, id) on delete set null (default_address_id);
create index customer_addresses_owner on public.customer_addresses(user_id);
alter table public.orders add column customer_id uuid default auth.uid();
alter table public.orders add column address_snapshot jsonb;
create index orders_customer on public.orders(customer_id);
create policy "customers read own orders" on public.orders for select to authenticated using (customer_id = auth.uid());
create policy "customers read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create or replace function public.place_customer_order(
 _name text, _phone text, _fulfillment text, _address_id uuid, _notes text, _payment text, _items jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare a public.customer_addresses; n text; address_text text;
begin
 if auth.uid() is null then raise exception 'Please sign in to place your order'; end if;
 if _fulfillment = 'delivery' then
   select * into a from public.customer_addresses where id = _address_id and user_id = auth.uid();
   if not found then raise exception 'Select a confirmed delivery address'; end if;
   _name := a.full_name; _phone := a.phone;
   address_text := concat_ws(', ', a.house, a.street, a.area, a.city, a.state, a.pin, nullif(a.landmark,''));
 end if;
 n := public.place_order(_name, _phone, _fulfillment, address_text, _notes, _payment, _items);
 update public.orders set customer_id = auth.uid(), address_snapshot = case when _fulfillment = 'delivery' then to_jsonb(a) - 'user_id' - 'id' - 'created_at' else null end where order_number = n;
 return n;
end $$;
revoke all on function public.place_customer_order(text,text,text,uuid,text,text,jsonb) from public, anon;
grant execute on function public.place_customer_order(text,text,text,uuid,text,text,jsonb) to authenticated;