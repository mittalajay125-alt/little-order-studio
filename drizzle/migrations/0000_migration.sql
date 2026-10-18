create type public.app_role as enum ('admin');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- first signed-up user becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  price_mini integer,
  price_full integer,
  price integer,
  is_topping boolean not null default false,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "anyone reads products" on public.products for select to anon, authenticated using (true);
create policy "admin manages products" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.settings (
  id integer primary key default 1 check (id = 1),
  delivery_charge integer not null default 0,
  delivery_enabled boolean not null default true,
  contact_phone text not null default '',
  contact_whatsapp text not null default '',
  stall_address text not null default '',
  instagram text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "anyone reads settings" on public.settings for select to anon, authenticated using (true);
create policy "admin updates settings" on public.settings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.settings(id) values (1);

create sequence public.order_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  fulfillment text not null check (fulfillment in ('pickup','delivery')),
  delivery_address text,
  notes text,
  subtotal integer not null,
  delivery_charge integer not null default 0,
  total integer not null,
  payment_method text not null check (payment_method in ('cash','upi')),
  status text not null default 'new' check (status in ('new','accepted','preparing','ready','out_for_delivery','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  created_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin reads orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin updates orders" on public.orders for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  size text,
  unit_price integer not null,
  toppings jsonb not null default '[]',
  toppings_price integer not null default 0,
  quantity integer not null,
  line_total integer not null
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "admin reads items" on public.order_items for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Secure order placement: prices computed from DB, never trusted from browser
create or replace function public.place_order(
  _name text, _phone text, _fulfillment text, _address text, _notes text, _payment text, _items jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  s public.settings; item jsonb; p public.products; t public.products; tid text;
  unit integer; tops integer; tnames jsonb; qty integer; sz text;
  sub integer := 0; dc integer := 0; oid uuid; onum text;
  rows jsonb := '[]';
begin
  _name := trim(coalesce(_name,'')); _phone := regexp_replace(coalesce(_phone,''),'[^0-9+]','','g');
  if length(_name) < 2 or length(_name) > 80 then raise exception 'Invalid name'; end if;
  if _phone !~ '^\+?[0-9]{10,13}$' then raise exception 'Invalid mobile number'; end if;
  if _fulfillment not in ('pickup','delivery') then raise exception 'Invalid fulfillment'; end if;
  if _payment not in ('cash','upi') then raise exception 'Invalid payment'; end if;
  if length(coalesce(_notes,'')) > 500 then raise exception 'Notes too long'; end if;
  select * into s from public.settings where id = 1;
  if _fulfillment = 'delivery' then
    if not s.delivery_enabled then raise exception 'Delivery unavailable'; end if;
    if length(trim(coalesce(_address,''))) < 10 or length(_address) > 500 then raise exception 'Please enter full delivery address'; end if;
    dc := s.delivery_charge;
  else _address := null; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 50 then
    raise exception 'Cart is empty'; end if;

  for item in select * from jsonb_array_elements(_items) loop
    select * into p from public.products where id = (item->>'product_id')::uuid and available and not is_topping;
    if not found then raise exception 'An item is no longer available'; end if;
    qty := (item->>'quantity')::int;
    if qty is null or qty < 1 or qty > 50 then raise exception 'Invalid quantity'; end if;
    sz := item->>'size';
    if p.price is not null then unit := p.price; sz := null;
    elsif sz = 'mini' and p.price_mini is not null then unit := p.price_mini;
    elsif sz = 'full' and p.price_full is not null then unit := p.price_full;
    else raise exception 'Invalid size'; end if;
    tops := 0; tnames := '[]';
    if jsonb_typeof(item->'toppings') = 'array' then
      for tid in select distinct jsonb_array_elements_text(item->'toppings') loop
        select * into t from public.products where id = tid::uuid and available and is_topping;
        if not found then raise exception 'A topping is no longer available'; end if;
        tops := tops + t.price; tnames := tnames || to_jsonb(t.name || ' (₹' || t.price || ')');
      end loop;
    end if;
    sub := sub + (unit + tops) * qty;
    rows := rows || jsonb_build_object('name',p.name,'size',sz,'unit',unit,'toppings',tnames,'tops',tops,'qty',qty,'line',(unit+tops)*qty);
  end loop;

  onum := 'CNM-' || nextval('public.order_seq');
  insert into public.orders(order_number,customer_name,customer_phone,fulfillment,delivery_address,notes,subtotal,delivery_charge,total,payment_method)
  values (onum,_name,_phone,_fulfillment,_address,nullif(trim(coalesce(_notes,'')),''),sub,dc,sub+dc,_payment) returning id into oid;
  insert into public.order_items(order_id,product_name,size,unit_price,toppings,toppings_price,quantity,line_total)
  select oid, r->>'name', r->>'size', (r->>'unit')::int, r->'toppings', (r->>'tops')::int, (r->>'qty')::int, (r->>'line')::int
  from jsonb_array_elements(rows) r;
  return onum;
end $$;
revoke all on function public.place_order(text,text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,text,jsonb) to anon, authenticated;
grant usage on sequence public.order_seq to service_role;

insert into public.products(category,name,price_mini,price_full,price,is_topping,sort_order) values
('Fruit Punch Brownies','Mix Fruits w Chocolate Brownie',180,280,null,false,1),
('Fruit Punch Brownies','Strawberry Loaded Brownie',160,250,null,false,2),
('Signature Brownie Bowls','Basic Brownie',90,140,null,false,10),
('Signature Brownie Bowls','Double Chocolate Brownie',100,160,null,false,11),
('Signature Brownie Bowls','Triple Chocolate Brownie',110,190,null,false,12),
('Signature Brownie Bowls','Nutella Brownie',130,200,null,false,13),
('Signature Brownie Bowls','Biscoff Brownie',130,200,null,false,14),
('Signature Brownie Bowls','Crunch Loaded Brownie',130,200,null,false,15),
('Signature Brownie Bowls','Oreo / KitKat Brownie',120,200,null,false,16),
('Truffle Balls','Truffle Balls',null,null,90,false,20),
('Fruit Cups','London Strawberry w Chocolate',null,null,160,false,30),
('Fruit Cups','Mixed Fruits w Chocolate',null,null,180,false,31),
('Toppings','Oreo',null,null,10,true,40),
('Toppings','Biscoff Biscuit Crumbs',null,null,20,true,41),
('Toppings','KitKat',null,null,10,true,42),
('Toppings','Almonds',null,null,10,true,43);