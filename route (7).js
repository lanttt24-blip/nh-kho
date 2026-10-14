import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { str } from '@/lib/validate';
export const dynamic = 'force-dynamic';
export const GET = route(null, async () => (await query('SELECT category_id,category_name FROM categories ORDER BY category_name')).rows);
export const POST = route(['admin'], async ({ body }) =>
  (await query('INSERT INTO categories(category_name) VALUES($1) RETURNING category_id', [str(body.name, 'Category name')])).rows[0]);
