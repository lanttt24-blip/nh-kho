import { tx } from './db';
import { HttpError } from './errors';
import { int, str } from './validate';

const PREFIX = { RECEIPT: 'RC', ISSUE: 'IS', TRANSFER: 'TR', ADJUSTMENT: 'ADJ', OPENING: 'OB' };

export async function newTx(c, type, userId, note) {
  const r = await c.query('INSERT INTO stock_transactions(transaction_type,note,created_by) VALUES($1,$2,$3) RETURNING transaction_id', [type, note || null, userId]);
  const id = r.rows[0].transaction_id;
  const ref = `${PREFIX[type]}-${String(id).padStart(6, '0')}`;
  await c.query('UPDATE stock_transactions SET reference=$1 WHERE transaction_id=$2', [ref, id]);
  return { id, ref };
}

// The ONLY place stock balances change. Always writes a ledger row (BR-05, NFR-09).
// Negative deltas use an atomic conditional UPDATE so stock can never go below zero, even under concurrency.
export async function applyDelta(c, txId, productId, warehouseId, type, delta, userId) {
  let r;
  if (delta > 0) {
    r = await c.query(
      `INSERT INTO stock_balances(product_id,warehouse_id,quantity) VALUES($1,$2,$3)
       ON CONFLICT (product_id,warehouse_id) DO UPDATE SET quantity=stock_balances.quantity+EXCLUDED.quantity, updated_at=now()
       RETURNING quantity`, [productId, warehouseId, delta]);
  } else {
    r = await c.query(
      `UPDATE stock_balances SET quantity=quantity+$3, updated_at=now()
       WHERE product_id=$1 AND warehouse_id=$2 AND quantity+$3>=0 RETURNING quantity`, [productId, warehouseId, delta]);
    if (!r.rowCount) {
      const a = await c.query('SELECT quantity FROM stock_balances WHERE product_id=$1 AND warehouse_id=$2', [productId, warehouseId]);
      throw new HttpError(409, `Insufficient stock. Available: ${a.rows[0]?.quantity ?? 0}`);
    }
  }
  await c.query('INSERT INTO stock_movements(transaction_id,product_id,warehouse_id,movement_type,quantity_delta,created_by) VALUES($1,$2,$3,$4,$5,$6)',
    [txId, productId, warehouseId, type, delta, userId]);
  return r.rows[0].quantity;
}

async function activeWarehouse(c, id) {
  const r = await c.query('SELECT is_active FROM warehouses WHERE warehouse_id=$1', [id]);
  if (!r.rowCount) throw new HttpError(404, 'Warehouse not found');
  if (!r.rows[0].is_active) throw new HttpError(409, 'Warehouse is inactive');
}
async function activeProduct(c, id) {
  const r = await c.query('SELECT is_active FROM products WHERE product_id=$1', [id]);
  if (!r.rowCount) throw new HttpError(404, 'Product not found');
  if (!r.rows[0].is_active) throw new HttpError(409, 'Product is inactive and cannot be used in new transactions');
}

export const receive = (userId, b) => tx(async (c) => {
  const w = int(b.warehouseId, 'Warehouse');
  if (!Array.isArray(b.lines) || !b.lines.length) throw new HttpError(400, 'At least one line is required');
  await activeWarehouse(c, w);
  let po = null, poLines = [];
  if (b.poId) {
    const poId = int(b.poId, 'Purchase order');
    po = (await c.query('SELECT * FROM purchase_orders WHERE po_id=$1 FOR UPDATE', [poId])).rows[0];
    if (!po) throw new HttpError(404, 'Purchase order not found');
    if (!['Approved', 'Partially Received'].includes(po.status))
      throw new HttpError(409, `Purchase order is ${po.status}; only Approved or Partially Received orders can be received`);
    poLines = (await c.query('SELECT * FROM purchase_order_lines WHERE po_id=$1 FOR UPDATE', [poId])).rows;
  }
  const t = await newTx(c, 'RECEIPT', userId, str(b.note, 'Note', { required: false }) + (po ? ` (PO #${po.po_id})` : ''));
  for (const l of b.lines) {
    const pid = int(l.productId, 'Product'), q = int(l.quantity, 'Quantity');
    await activeProduct(c, pid);
    if (po) {
      const pl = poLines.find((x) => x.product_id === pid);
      if (!pl) throw new HttpError(400, 'A product in this receipt is not on the purchase order');
      if (pl.received_qty + q > pl.ordered_qty) throw new HttpError(409, 'Received quantity exceeds the ordered quantity');
      pl.received_qty += q;
      await c.query('UPDATE purchase_order_lines SET received_qty=$1 WHERE line_id=$2', [pl.received_qty, pl.line_id]);
    }
    await applyDelta(c, t.id, pid, w, 'RECEIPT', q, userId);
  }
  if (po) {
    const done = poLines.every((x) => x.received_qty >= x.ordered_qty);
    await c.query('UPDATE purchase_orders SET status=$1 WHERE po_id=$2', [done ? 'Received' : 'Partially Received', po.po_id]);
  }
  return { reference: t.ref };
});

export const issue = (userId, b) => tx(async (c) => {
  const w = int(b.warehouseId, 'Warehouse'), p = int(b.productId, 'Product'), q = int(b.quantity, 'Quantity');
  await activeWarehouse(c, w); await activeProduct(c, p);
  const t = await newTx(c, 'ISSUE', userId, str(b.note, 'Reason', { required: false }));
  const balance = await applyDelta(c, t.id, p, w, 'ISSUE', -q, userId);
  return { reference: t.ref, balance };
});

export const transfer = (userId, b) => tx(async (c) => {
  const from = int(b.fromWarehouseId, 'Source warehouse'), to = int(b.toWarehouseId, 'Destination warehouse');
  const p = int(b.productId, 'Product'), q = int(b.quantity, 'Quantity');
  if (from === to) throw new HttpError(400, 'Source and destination warehouses must be different');
  await activeWarehouse(c, from); await activeWarehouse(c, to); await activeProduct(c, p);
  const t = await newTx(c, 'TRANSFER', userId, str(b.note, 'Note', { required: false }));
  await applyDelta(c, t.id, p, from, 'TRANSFER', -q, userId);   // fails (and rolls back everything) if source is short
  await applyDelta(c, t.id, p, to, 'TRANSFER', q, userId);
  return { reference: t.ref };
});

export const adjust = (userId, b) => tx(async (c) => {
  const w = int(b.warehouseId, 'Warehouse'), p = int(b.productId, 'Product');
  const counted = int(b.countedQty, 'Counted quantity', 0);
  const reason = str(b.reason, 'Reason');
  await activeWarehouse(c, w); await activeProduct(c, p);
  const cur = await c.query('SELECT quantity FROM stock_balances WHERE product_id=$1 AND warehouse_id=$2 FOR UPDATE', [p, w]);
  const previous = cur.rows[0]?.quantity ?? 0;
  const delta = counted - previous;
  if (delta === 0) throw new HttpError(400, 'Counted quantity matches the system quantity; no adjustment needed');
  const t = await newTx(c, 'ADJUSTMENT', userId, reason);
  await applyDelta(c, t.id, p, w, 'ADJUSTMENT', delta, userId);
  return { reference: t.ref, previous, counted, delta };
});
