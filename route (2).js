import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { sign, COOKIE } from '@/lib/auth';
import { fail } from '@/lib/api';

const hits = new Map(); // simple per-instance rate limit (NFR-03)

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
    if (recent.length >= 8) return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
    recent.push(now); hits.set(ip, recent);

    const { email, password } = await req.json().catch(() => ({}));
    const r = await query(
      'SELECT u.user_id,u.full_name,u.password_hash,u.is_active,r.role_name FROM users u JOIN roles r USING(role_id) WHERE lower(u.email)=lower($1)',
      [String(email || '')]);
    const u = r.rows[0];
    const ok = u && u.is_active && (await bcrypt.compare(String(password || ''), u.password_hash));
    if (!ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const res = NextResponse.json({ id: u.user_id, name: u.full_name, role: u.role_name });
    res.cookies.set(COOKIE, sign(u), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 3600 });
    return res;
  } catch (e) { return fail(e); }
}
