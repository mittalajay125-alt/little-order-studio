ALTER TABLE public.settings ADD COLUMN shop_latitude double precision, ADD COLUMN shop_longitude double precision;
UPDATE public.settings SET shop_latitude = 26.857264188373723, shop_longitude = 75.74637446436698 WHERE id = 1;
ALTER TABLE public.settings ADD CONSTRAINT shop_latitude_range CHECK (shop_latitude BETWEEN -90 AND 90), ADD CONSTRAINT shop_longitude_range CHECK (shop_longitude BETWEEN -180 AND 180);
ALTER TABLE public.orders ADD COLUMN delivery_distance_km double precision;
COMMENT ON COLUMN public.settings.delivery_charge IS 'DEPRECATED: replaced by distance-based delivery tiers';
CREATE OR REPLACE FUNCTION public.delivery_distance_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$ SELECT 6371.0 * 2 * asin(sqrt(least(1.0, greatest(0.0, power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2))))) $$;
CREATE OR REPLACE FUNCTION public.delivery_charge_for_km(distance double precision)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$ SELECT CASE WHEN distance < 0 OR distance > 10 THEN NULL WHEN distance <= 3 THEN 30 WHEN distance <= 6 THEN 40 ELSE 60 END $$;
CREATE OR REPLACE FUNCTION public.place_order(_name text, _phone text, _fulfillment text, _address text, _notes text, _payment text, _items jsonb, _address_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 s public.settings; a public.customer_addresses; item jsonb; p public.products; t public.products; tid text;
 unit integer; tops integer; tnames jsonb; qty integer; sz text;
 sub integer := 0; dc integer := 0; distance double precision; oid uuid; onum text; rows jsonb := '[]';
BEGIN
 _name := trim(coalesce(_name,'')); _phone := regexp_replace(coalesce(_phone,''),'[^0-9+]','','g');
 IF _fulfillment NOT IN ('pickup','delivery') OR _fulfillment IS NULL THEN RAISE EXCEPTION 'Invalid fulfillment'; END IF;
 IF _payment NOT IN ('cash','upi') OR _payment IS NULL THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 IF length(coalesce(_notes,'')) > 500 THEN RAISE EXCEPTION 'Notes too long'; END IF;
 SELECT * INTO s FROM public.settings WHERE id=1;
 IF _fulfillment='delivery' THEN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in to place your order'; END IF;
  IF NOT coalesce(s.delivery_enabled,false) THEN RAISE EXCEPTION 'Delivery unavailable'; END IF;
  IF s.shop_latitude IS NULL OR s.shop_longitude IS NULL THEN RAISE EXCEPTION 'Shop delivery location is not configured. Choose Stall Pickup.'; END IF;
  SELECT * INTO a FROM public.customer_addresses WHERE id=_address_id AND user_id=auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select a confirmed delivery address'; END IF;
  IF a.latitude IS NULL OR a.longitude IS NULL THEN RAISE EXCEPTION 'Your saved address needs location coordinates before delivery. Edit the address or choose Stall Pickup.'; END IF;
  distance := public.delivery_distance_km(s.shop_latitude,s.shop_longitude,a.latitude,a.longitude);
  dc := public.delivery_charge_for_km(distance);
  IF dc IS NULL THEN RAISE EXCEPTION 'Home delivery is unavailable beyond 10 km. Please choose Stall Pickup.'; END IF;
  _name := a.full_name; _phone := regexp_replace(a.phone,'[^0-9+]','','g');
  _address := concat_ws(', ',a.house,a.street,a.area,a.city,a.state,a.pin,nullif(a.landmark,''));
 ELSE _address := NULL; END IF;
 IF length(_name)<2 OR length(_name)>80 THEN RAISE EXCEPTION 'Invalid name'; END IF;
 IF _phone !~ '^\+?[0-9]{10,13}$' THEN RAISE EXCEPTION 'Invalid mobile number'; END IF;
 IF _items IS NULL OR jsonb_typeof(_items)<>'array' THEN RAISE EXCEPTION 'Cart is empty'; END IF;
 IF jsonb_array_length(_items)=0 OR jsonb_array_length(_items)>50 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
  SELECT * INTO p FROM public.products WHERE id=(item->>'product_id')::uuid AND available AND NOT is_topping;
  IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available'; END IF;
  qty := (item->>'quantity')::int;
  IF qty IS NULL OR qty<1 OR qty>50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  sz := item->>'size';
  IF p.price IS NOT NULL THEN unit:=p.price; sz:=NULL;
  ELSIF sz='mini' AND p.price_mini IS NOT NULL THEN unit:=p.price_mini;
  ELSIF sz='full' AND p.price_full IS NOT NULL THEN unit:=p.price_full;
  ELSE RAISE EXCEPTION 'Invalid size'; END IF;
  tops:=0; tnames:='[]';
  IF jsonb_typeof(item->'toppings')='array' THEN
   FOR tid IN SELECT DISTINCT jsonb_array_elements_text(item->'toppings') LOOP
    SELECT * INTO t FROM public.products WHERE id=tid::uuid AND available AND is_topping;
    IF NOT FOUND THEN RAISE EXCEPTION 'A topping is no longer available'; END IF;
    tops:=tops+t.price; tnames:=tnames || to_jsonb(t.name || ' (₹' || t.price || ')');
   END LOOP;
  END IF;
  sub:=sub+(unit+tops)*qty;
  rows:=rows || jsonb_build_object('name',p.name,'size',sz,'unit',unit,'toppings',tnames,'tops',tops,'qty',qty,'line',(unit+tops)*qty);
 END LOOP;
 onum:='CNM-' || nextval('public.order_seq');
 INSERT INTO public.orders(order_number,customer_name,customer_phone,fulfillment,delivery_address,notes,subtotal,delivery_charge,total,payment_method,customer_id,address_snapshot,delivery_distance_km)
 VALUES(onum,_name,_phone,_fulfillment,_address,nullif(trim(coalesce(_notes,'')),''),sub,dc,sub+dc,_payment,auth.uid(),CASE WHEN _fulfillment='delivery' THEN to_jsonb(a)-'user_id'-'id'-'created_at' ELSE NULL END,distance) RETURNING id INTO oid;
 INSERT INTO public.order_items(order_id,product_name,size,unit_price,toppings,toppings_price,quantity,line_total)
 SELECT oid,r->>'name',r->>'size',(r->>'unit')::int,r->'toppings',(r->>'tops')::int,(r->>'qty')::int,(r->>'line')::int FROM jsonb_array_elements(rows) r;
 RETURN onum;
END $$;
REVOKE ALL ON FUNCTION public.place_order(text,text,text,text,text,text,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,text,text,jsonb,uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.place_order(_name text, _phone text, _fulfillment text, _address text, _notes text, _payment text, _items jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN public.place_order(_name,_phone,_fulfillment,_address,_notes,_payment,_items,NULL::uuid); END $$;
CREATE OR REPLACE FUNCTION public.place_customer_order(_name text, _phone text, _fulfillment text, _address_id uuid, _notes text, _payment text, _items jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in to place your order'; END IF;
 RETURN public.place_order(_name,_phone,_fulfillment,NULL::text,_notes,_payment,_items,_address_id);
END $$;
REVOKE ALL ON FUNCTION public.place_customer_order(text,text,text,uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_customer_order(text,text,text,uuid,text,text,jsonb) TO authenticated;
