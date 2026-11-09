import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { pool } from '@/lib/mysql';
import { apiError, sameOrigin } from '@/lib/http';

export const runtime = 'nodejs';
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!sameOrigin(_request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in to cancel a booking.' }, { status: 401 });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid booking id.' }, { status: 400 });
    await pool.query('CALL sp_cancel_booking(?,?,?)', [id,user.id,user.role==='ADMIN']);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
