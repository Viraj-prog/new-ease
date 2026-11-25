-- Delivery: the stores and the items they sell.
-- Run in the Supabase SQL editor. Transactional and safe to run again (it updates the sample rows).
--
-- Both tables are read-only from the app: signed-in users can look, and only you (in the SQL or
-- table editor) can add or change items. Until this script is run the app shows the same sample
-- list built into it (src/lib/delivery.ts).

begin;

create table if not exists public.delivery_stores (
  id text primary key,
  name text not null,
  -- Colour behind the item pictures: blue, red or green.
  tint text not null default 'blue' check (tint in ('blue', 'red', 'green')),
  sort integer not null default 0
);

create table if not exists public.delivery_items (
  id text primary key,
  "storeId" text not null references public.delivery_stores (id) on delete cascade,
  name text not null,
  -- Size or variant shown under the name, such as "2 L".
  unit text not null default '',
  category text not null default '',
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  -- The picture: a single emoji.
  emoji text not null default '📦',
  sort integer not null default 0
);

alter table public.delivery_stores enable row level security;
alter table public.delivery_items enable row level security;

drop policy if exists "delivery stores read" on public.delivery_stores;
create policy "delivery stores read" on public.delivery_stores
  for select to authenticated using (true);

drop policy if exists "delivery items read" on public.delivery_items;
create policy "delivery items read" on public.delivery_items
  for select to authenticated using (true);

insert into public.delivery_stores (id, name, tint, sort) values
  ('walmart', 'Walmart', 'blue', 1),
  ('target', 'Target', 'red', 2),
  ('dollarama', 'Dollarama', 'green', 3)
on conflict (id) do update
  set name = excluded.name, tint = excluded.tint, sort = excluded.sort;

insert into public.delivery_items
  (id, "storeId", name, unit, category, description, price, emoji, sort)
values
  ('walmart-bananas', 'walmart', 'Bananas', '1 bunch', 'Produce', 'A bunch of ripe yellow bananas, ready to eat or bake with.', 1.89, '🍌', 1),
  ('walmart-milk', 'walmart', 'Whole Milk', '2 L', 'Dairy', 'Fresh whole milk, 3.25% milk fat. Delivered cold and ready for cereal, coffee, or cooking.', 4.49, '🥛', 2),
  ('walmart-bread', 'walmart', 'Whole Wheat Bread', '675 g', 'Bakery', 'Soft sliced whole wheat bread for sandwiches and toast.', 3.29, '🍞', 3),
  ('walmart-eggs', 'walmart', 'Large Eggs', '12 pack', 'Dairy', 'A dozen large grade A eggs.', 4.19, '🥚', 4),
  ('walmart-apples', 'walmart', 'Gala Apples', '3 lb bag', 'Produce', 'Crisp, sweet Gala apples.', 5.49, '🍎', 5),
  ('walmart-cheese', 'walmart', 'Cheddar Cheese', '400 g', 'Dairy', 'Medium cheddar cheese block.', 6.29, '🧀', 6),
  ('target-tshirt', 'target', 'Crew T-Shirt', 'Teal · M', 'Clothing', 'A soft cotton crew neck T-shirt.', 14.00, '👕', 1),
  ('target-lamp', 'target', 'Desk Lamp', 'LED', 'Home', 'A compact LED desk lamp for studying and late nights.', 24.99, '💡', 2),
  ('target-pillow', 'target', 'Throw Pillow', '18 in', 'Home', 'A plush square throw pillow for the couch or bed.', 19.99, '🛋️', 3),
  ('target-socks', 'target', 'Crew Socks', '6 pairs', 'Clothing', 'Everyday cushioned crew socks.', 9.99, '🧦', 4),
  ('target-headphones', 'target', 'Headphones', 'Wireless', 'Electronics', 'Over-ear wireless headphones.', 39.99, '🎧', 5),
  ('target-mug', 'target', 'Coffee Mug', '350 mL', 'Kitchen', 'A sturdy ceramic mug.', 7.50, '☕', 6),
  ('dollarama-notebook', 'dollarama', 'Spiral Notebook', '120 pages', 'Stationery', 'A lined spiral notebook for class notes.', 1.25, '📓', 1),
  ('dollarama-candle', 'dollarama', 'Scented Candle', 'Vanilla', 'Home', 'A small vanilla scented candle.', 1.50, '🕯️', 2),
  ('dollarama-giftbag', 'dollarama', 'Gift Bag', 'Medium', 'Party', 'A medium gift bag with handles.', 1.25, '🛍️', 3),
  ('dollarama-pens', 'dollarama', 'Ballpoint Pens', '10 pack', 'Stationery', 'Ten blue ballpoint pens.', 2.00, '🖊️', 4),
  ('dollarama-balloons', 'dollarama', 'Balloons', '15 pack', 'Party', 'Assorted colour party balloons.', 1.75, '🎈', 5),
  ('dollarama-soap', 'dollarama', 'Dish Soap', '500 mL', 'Cleaning', 'Lemon scented dish soap.', 2.25, '🧼', 6)
on conflict (id) do update set
  "storeId" = excluded."storeId",
  name = excluded.name,
  unit = excluded.unit,
  category = excluded.category,
  description = excluded.description,
  price = excluded.price,
  emoji = excluded.emoji,
  sort = excluded.sort;

notify pgrst, 'reload schema';
commit;
