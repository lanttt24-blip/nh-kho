import { route } from '@/lib/api';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = route(null, async () => {
  const r = await query(`
    SELECT
     (SELECT count(*)::int FROM products WHERE is_active) products,
     (SELECT count(*)::int FROM warehouses WHERE is_active) warehouses,
     (SELECT count(*)::int FROM (SELECT p.product_id FROM products p LEFT JOIN stock_balances b USING(product_id)
        WHERE p.is_active GROUP BY p.product_id HAVING COALESCE(SUM(b.quantity),0) < MAX(p.reorder_level)) x) low_stock,
     (SELECT count(*)::int FROM purchase_orders WHERE status IN ('Draft','Submitted','Approved','Partially Received')) open_orders,
     (SELECT COALESCE(SUM(b.quantity*p.unit_cost),0)::float FROM stock_balances b JOIN products p USING(product_id)) stock_value,
     (SELECT count(*)::int FROM stock_movements WHERE created_at > now() - interval '7 days') movements_7d`);
  return r.rows[0];
});
