import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { date } from '@/lib/validate';
export const dynamic = 'force-dynamic';
export const GET = route(['manager', 'admin'], async ({ req }) => {
  const q = req.nextUrl.searchParams, w = [], v = [];
  const add = (cond, x) => { v.push(x); w.push(cond.replace('?', '$' + v.length)); };
  const from = date(q.get('from'), 'From'), to = date(q.get('to'), 'To');
  if (from) add('m.created_at >= ?::date', from);
  if (to) add('m.created_at < (?::date + 1)', to);
  if (q.get('warehouseId')) add('m.warehouse_id = ?', Number(q.get('warehouseId')));
  if (q.get('productId')) add('m.product_id = ?', Number(q.get('productId')));
  if (q.get('type')) add('m.movement_type = ?', q.get('type'));
  const r = await query(
    `SELECT m.movement_id,m.created_at,t.reference,m.movement_type,p.sku,p.name product_name,w.name warehouse_name,
            m.quantity_delta,u.full_name user_name,t.note
     FROM stock_movements m JOIN stock_transactions t USING(transaction_id) JOIN products p USING(product_id)
     JOIN warehouses w USING(warehouse_id) LEFT JOIN users u ON u.user_id=m.created_by
     ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY m.movement_id DESC LIMIT 300`, v);
  return r.rows;
});
