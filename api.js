import { NextResponse } from 'next/server';
import { getUser } from './auth';
import { HttpError } from './errors';

export function fail(e) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e?.code === '23505') return NextResponse.json({ error: 'Duplicate value (for example, the SKU or email already exists)' }, { status: 409 });
  if (e?.code === '23503') return NextResponse.json({ error: 'Referenced record does not exist or is still in use' }, { status: 409 });
  if (e?.code === '23514' || e?.code === '22P02' || e?.code === '22003') return NextResponse.json({ error: 'Invalid value submitted' }, { status: 400 });
  if (e?.code === '42P01') return NextResponse.json({ error: 'Database is not set up yet. Open /api/setup?token=YOUR_SETUP_TOKEN once.' }, { status: 500 });
  console.error(e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// roles = null → any authenticated user
export function route(roles, fn) {
  return async (req, ctx) => {
    try {
      const user = getUser(req);
      if (!user) throw new HttpError(401, 'Not authenticated');
      if (roles && !roles.includes(user.role)) throw new HttpError(403, 'You do not have permission for this action');
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await req.json().catch(() => ({})) : {};
      const params = ctx?.params ? await ctx.params : {};
      const data = await fn({ user, body, req, params });
      return NextResponse.json(data ?? { ok: true });
    } catch (e) { return fail(e); }
  };
}
