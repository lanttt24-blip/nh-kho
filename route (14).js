import { route } from '@/lib/api';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = route(['manager', 'admin'], async () => (await query(
  `SELECT p.product_id,p.sku,p.name,p.unit,p.reorder_level,COALESCE(SUM(b.quantity),0)::int total_qty
   FROM products p LEFT JOIN stock_balances b USING(product_id)
   WHERE p.is_active GROUP BY p.product_id
   HAVING COALESCE(SUM(b.quantity),0) < p.reorder_level ORDER BY COALESCE(SUM(b.quantity),0) - p.reorder_level`)).rows);
