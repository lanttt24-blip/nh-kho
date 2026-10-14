import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { HttpError } from '@/lib/errors';
import { str, int, money } from '@/lib/validate';

export const PATCH = route(['admin'], async ({ body, params }) => {
  const id = int(params.id, 'Product ID');
  const sets = [], vals = [];
  const add = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
  if (body.name !== undefined) add('name', str(body.name, 'Name'));
  if (body.categoryId !== undefined) add('category_id', body.categoryId || null);
  if (body.unit !== undefined) add('unit', str(body.unit, 'Unit'));
  if (body.unitCost !== undefined) add('unit_cost', money(body.unitCost, 'Unit cost'));
  if (body.reorderLevel !== undefined) add('reorder_level', int(body.reorderLevel, 'Reorder level', 0));
  if (body.isActive !== undefined) add('is_active', !!body.isActive);
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  vals.push(id);
  const r = await query(`UPDATE products SET ${sets.join(',')} WHERE product_id=$${vals.length} RETURNING product_id`, vals);
  if (!r.rowCount) throw new HttpError(404, 'Product not found');
  return { ok: true };
});
