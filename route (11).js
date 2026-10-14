import { NextResponse } from 'next/server';
import { setupDatabase } from '@/lib/schema';
import { fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Open once after deploying: /api/setup?token=<SETUP_TOKEN>
export async function GET(req) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected || req.nextUrl.searchParams.get('token') !== expected)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { return NextResponse.json(await setupDatabase()); } catch (e) { return fail(e); }
}
