import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { str } from '@/lib/validate';
export const dynamic = 'force-dynamic';
export const GET = route(null, async () => (await query('SELECT supplier_id,name,email,phone,address,is_active FROM suppliers ORDER BY name')).rows);
export const POST = route(['admin', 'purchasing'], async ({ body }) =>
  (await query('INSERT INTO suppliers(name,email,phone,address) VALUES($1,$2,$3,$4) RETURNING supplier_id',
    [str(body.name, 'Name'), ...['email', 'phone', 'address'].map((k) => str(body[k], k, { required: false }) || null)])).rows[0]);
