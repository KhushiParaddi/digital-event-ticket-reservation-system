import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { pool } from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';

export type Role = 'CUSTOMER' | 'ADMIN';
export interface SessionUser { id: number; name: string; email: string; role: Role }
const cookieName = 'event_session';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id))
    .setIssuedAt().setExpirationTime('8h').sign(secret());
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  (await cookies()).set(cookieName, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id)) return null;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id,name,email,role FROM Users WHERE user_id=? LIMIT 1', [id],
    );
    if (!rows[0]) return null;
    return { id: Number(rows[0].user_id), name: rows[0].name, email: rows[0].email, role: rows[0].role };
  } catch {
    return null;
  }
}

export async function requireUser() {
  return currentUser();
}
