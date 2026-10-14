import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { str, int, money } from '@/lib/validate';
export const dynamic = 'force-dynamic';

export const GET = route(null, async ({ req }) => {
  const q = req.nextUrl.searchParams;
  const search = `%${(q.get('q') || '').trim()}%`;
  const all = q.get('all') === '1';
  const r = await query(
    `SELECT p.product_id,p.sku,p.name,p.unit,p.unit_cost::float unit_cost,p.reorder_level,p.is_active,p.category_id,c.category_name,
            COALESCE(SUM(b.quantity),0)::int total_qty
     FROM products p LEFT JOIN categories c USING(category_id) LEFT JOIN stock_balances b USING(product_id)
     WHERE (p.name ILIKE $1 OR p.sku ILIKE $1) AND ($2 OR p.is_active)
     GROUP BY p.product_id,c.category_name ORDER BY p.name`, [search, all]);
  return r.rows;
});

export const POST = route(['admin'], async ({ body }) => {
  const r = await query(
    'INSERT INTO products(sku,name,category_id,unit,unit_cost,reorder_level) VALUES($1,$2,$3,$4,$5,$6) RETURNING product_id',
    [str(body.sku, 'SKU').toUpperCase(), str(body.name, 'Name'), body.categoryId || null,
     str(body.unit, 'Unit', { required: false }) || 'pcs', money(body.unitCost, 'Unit cost'), int(body.reorderLevel ?? 0, 'Reorder level', 0)]);
  return r.rows[0];
});
