import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { str } from '@/lib/validate';
export const dynamic = 'force-dynamic';
export const GET = route(null, async () => (await query('SELECT warehouse_id,name,location,is_active FROM warehouses ORDER BY name')).rows);
export const POST = route(['admin'], async ({ body }) =>
  (await query('INSERT INTO warehouses(name,location) VALUES($1,$2) RETURNING warehouse_id', [str(body.name, 'Name'), str(body.location, 'Location', { required: false })])).rows[0]);
