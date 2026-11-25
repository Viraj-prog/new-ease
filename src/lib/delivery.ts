import type { Result } from '@/lib/rides';
import { supabase } from '@/lib/supabase';

export type Tint = 'blue' | 'red' | 'green';
export type Item = {
  id: string;
  storeId: string;
  name: string;
  unit: string;
  category: string;
  description: string;
  price: number;
  emoji: string;
};
export type Store = { id: string; name: string; tint: Tint; items: Item[] };

// What is in the cart: how many of each item, by item id.
export type Cart = Record<string, number>;
export type CartLine = { item: Item; qty: number };

// The theme's soft avatar colours, used behind the item pictures.
export const TINT_SLOT: Record<Tint, number> = { blue: 4, red: 3, green: 1 };

// A flat placeholder fee until delivery pricing is decided.
export const DELIVERY_FEE = 4.99;

export const money = (n: number) => `$${n.toFixed(2)}`;

export function cartLines(cart: Cart, stores: Store[]): CartLine[] {
  const items = stores.flatMap((s) => s.items);
  return Object.entries(cart).flatMap(([id, qty]) => {
    const item = items.find((i) => i.id === id);
    return item && qty > 0 ? [{ item, qty }] : [];
  });
}

// Added up in cents, so prices like 1.89 do not drift.
export const subtotalOf = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + Math.round(l.item.price * 100) * l.qty, 0) / 100;

// There are no delivery drivers in the database yet, so these are sample ones.
const sample = (id: string, driverName: string, rating: number, pickupKm: number): Result => ({
  rideId: id,
  driverName,
  rating,
  // Not shown for deliveries.
  departAt: '',
  fare: null,
  pickupKm,
  dropoffKm: 0,
  tripKm: 0,
  tripMin: 0,
  route: [],
  start: { lat: 0, lng: 0 },
  end: { lat: 0, lng: 0 },
});

export const SAMPLE_DRIVERS: Result[] = [
  sample('delivery-driver-alex', 'Alex Chen', 4.9, 1.2),
  sample('delivery-driver-priya', 'Priya Sharma', 4.8, 2.1),
  sample('delivery-driver-marcus', 'Marcus Lee', 4.6, 0.8),
];

// ---- Catalogue ----

type Row = [id: string, name: string, unit: string, category: string, description: string, price: number, emoji: string];

const store = (id: string, name: string, tint: Tint, rows: Row[]): Store => ({
  id,
  name,
  tint,
  items: rows.map(([key, itemName, unit, category, description, price, emoji]) => ({
    id: `${id}-${key}`,
    storeId: id,
    name: itemName,
    unit,
    category,
    description,
    price,
    emoji,
  })),
});

// The same rows as the delivery catalogue migration in supabase/migrations/, shown until it has
// been run.
export const BUILT_IN: Store[] = [
  store('walmart', 'Walmart', 'blue', [
    ['bananas', 'Bananas', '1 bunch', 'Produce', 'A bunch of ripe yellow bananas, ready to eat or bake with.', 1.89, '🍌'],
    ['milk', 'Whole Milk', '2 L', 'Dairy', 'Fresh whole milk, 3.25% milk fat. Delivered cold and ready for cereal, coffee, or cooking.', 4.49, '🥛'],
    ['bread', 'Whole Wheat Bread', '675 g', 'Bakery', 'Soft sliced whole wheat bread for sandwiches and toast.', 3.29, '🍞'],
    ['eggs', 'Large Eggs', '12 pack', 'Dairy', 'A dozen large grade A eggs.', 4.19, '🥚'],
    ['apples', 'Gala Apples', '3 lb bag', 'Produce', 'Crisp, sweet Gala apples.', 5.49, '🍎'],
    ['cheese', 'Cheddar Cheese', '400 g', 'Dairy', 'Medium cheddar cheese block.', 6.29, '🧀'],
  ]),
  store('target', 'Target', 'red', [
    ['tshirt', 'Crew T-Shirt', 'Teal · M', 'Clothing', 'A soft cotton crew neck T-shirt.', 14.0, '👕'],
    ['lamp', 'Desk Lamp', 'LED', 'Home', 'A compact LED desk lamp for studying and late nights.', 24.99, '💡'],
    ['pillow', 'Throw Pillow', '18 in', 'Home', 'A plush square throw pillow for the couch or bed.', 19.99, '🛋️'],
    ['socks', 'Crew Socks', '6 pairs', 'Clothing', 'Everyday cushioned crew socks.', 9.99, '🧦'],
    ['headphones', 'Headphones', 'Wireless', 'Electronics', 'Over-ear wireless headphones.', 39.99, '🎧'],
    ['mug', 'Coffee Mug', '350 mL', 'Kitchen', 'A sturdy ceramic mug.', 7.5, '☕'],
  ]),
  store('dollarama', 'Dollarama', 'green', [
    ['notebook', 'Spiral Notebook', '120 pages', 'Stationery', 'A lined spiral notebook for class notes.', 1.25, '📓'],
    ['candle', 'Scented Candle', 'Vanilla', 'Home', 'A small vanilla scented candle.', 1.5, '🕯️'],
    ['giftbag', 'Gift Bag', 'Medium', 'Party', 'A medium gift bag with handles.', 1.25, '🛍️'],
    ['pens', 'Ballpoint Pens', '10 pack', 'Stationery', 'Ten blue ballpoint pens.', 2.0, '🖊️'],
    ['balloons', 'Balloons', '15 pack', 'Party', 'Assorted colour party balloons.', 1.75, '🎈'],
    ['soap', 'Dish Soap', '500 mL', 'Cleaning', 'Lemon scented dish soap.', 2.25, '🧼'],
  ]),
];

// The stores and items from the database, or the built-in list if they cannot be read.
export async function loadCatalog(): Promise<Store[]> {
  const [stores, items] = await Promise.all([
    supabase.from('delivery_stores').select('id, name, tint').order('sort'),
    supabase.from('delivery_items').select('*').order('sort'),
  ]);
  const error = stores.error ?? items.error;
  if (error) {
    console.warn('Delivery items could not load, showing the built-in list:', error.message);
    return BUILT_IN;
  }
  if (!stores.data?.length) return BUILT_IN;
  return (stores.data as Omit<Store, 'items'>[]).map((s) => ({
    ...s,
    items: ((items.data ?? []) as Item[])
      .filter((i) => i.storeId === s.id)
      .map((i) => ({ ...i, price: Number(i.price) })),
  }));
}
