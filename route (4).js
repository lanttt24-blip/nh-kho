import { route } from '@/lib/api';
import { query, tx } from '@/lib/db';
import { HttpError } from '@/lib/errors';
import { int, money, date } from '@/lib/validate';
export const dynamic = 'force-dynamic';

export const GET = route(null, async () => (await query(
  `SELECT po.po_id,po.status,po.created_at,po.expected_date,s.name supplier_name,
     COALESCE(json_agg(json_build_object('lineId',l.line_id,'productId',l.product_id,'sku',p.sku,'name',p.name,
       'orderedQty',l.ordered_qty,'receivedQty',l.received_qty,'unitCost',l.unit_cost::float) ORDER BY l.line_id)
       FILTER (WHERE l.line_id IS NOT NULL),'[]') lines
   FROM purchase_orders po JOIN suppliers s USING(supplier_id)
   LEFT JOIN purchase_order_lines l ON l.po_id=po.po_id LEFT JOIN products p ON p.product_id=l.product_id
   GROUP BY po.po_id,s.name ORDER BY po.po_id DESC`)).rows);

export const POST = route(['purchasing', 'admin'], async ({ user, body }) => {
  const supplierId = int(body.supplierId, 'Supplier');
  if (!Array.isArray(body.lines) || !body.lines.length) throw new HttpError(400, 'At least one line is required');
  return tx(async (c) => {
    const s = await c.query('SELECT is_active FROM suppliers WHERE supplier_id=$1', [supplierId]);
    if (!s.rowCount || !s.rows[0].is_active) throw new HttpError(409, 'Supplier not found or inactive');
    const po = await c.query('INSERT INTO purchase_orders(supplier_id,created_by,expected_date) VALUES($1,$2,$3) RETURNING po_id',
      [supplierId, user.id, date(body.expectedDate, 'Expected date')]);
    for (const l of body.lines) {
      const pid = int(l.productId, 'Product');
      const p = await c.query('SELECT is_active FROM products WHERE product_id=$1', [pid]);
      if (!p.rowCount || !p.rows[0].is_active) throw new HttpError(409, 'Product not found or inactive');
      await c.query('INSERT INTO purchase_order_lines(po_id,product_id,ordered_qty,unit_cost) VALUES($1,$2,$3,$4)',
        [po.rows[0].po_id, pid, int(l.quantity, 'Quantity'), money(l.unitCost, 'Unit cost')]);
    }
    return { poId: po.rows[0].po_id };
  });
});
