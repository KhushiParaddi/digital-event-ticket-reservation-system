import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';
import { sameOrigin } from '@/lib/http';
export async function POST(request:Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  await clearSession();
  return NextResponse.json({ ok: true });
}
