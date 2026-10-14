import { route } from '@/lib/api';
import { tx } from '@/lib/db';
import { HttpError } from '@/lib/errors';
import { int } from '@/lib/validate';

// BR-08: only valid status transitions, each limited to specific roles.
const ALL = ['purchasing', 'manager', 'admin'];
const TRANSITIONS = {
  'Draft>Submitted': ['purchasing', 'admin'],
  'Submitted>Approved': ['manager', 'admin'],
  'Draft>Cancelled': ALL, 'Submitted>Cancelled': ALL, 'Approved>Cancelled': ALL,
};

export const PATCH = route(ALL, async ({ user, body, params }) => {
  const id = int(params.id, 'Purchase order');
  return tx(async (c) => {
    const r = await c.query('SELECT status FROM purchase_orders WHERE po_id=$1 FOR UPDATE', [id]);
    if (!r.rowCount) throw new HttpError(404, 'Purchase order not found');
    const key = `${r.rows[0].status}>${body.status}`;
    const allowed = TRANSITIONS[key];
    if (!allowed) throw new HttpError(409, `Cannot change status from ${r.rows[0].status} to ${body.status}`);
    if (!allowed.includes(user.role)) throw new HttpError(403, 'Your role cannot perform this status change');
    await c.query('UPDATE purchase_orders SET status=$1 WHERE po_id=$2', [body.status, id]);
    return { status: body.status };
  });
});
