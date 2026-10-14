import { route } from '@/lib/api';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = route(null, async ({ req }) => {
  const wid = req.nextUrl.searchParams.get('warehouseId');
  const r = await query(
    `SELECT b.stock_id,p.product_id,p.sku,p.name,p.unit,w.warehouse_id,w.name warehouse_name,b.quantity,p.reorder_level,
            (b.quantity < p.reorder_level) low
     FROM stock_balances b JOIN products p USING(product_id) JOIN warehouses w USING(warehouse_id)
     WHERE ($1::int IS NULL OR w.warehouse_id=$1::int) ORDER BY w.name,p.name`, [wid ? Number(wid) : null]);
  return r.rows;
});
