import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '@/lib/mysql';
import { createSession } from '@/lib/auth';
import { apiError, sameOrigin, validationError } from '@/lib/http';
import type { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';
const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72).refine(value => new TextEncoder().encode(value).length <= 72) });

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError('Enter a valid email and password.');
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id,name,email,password_hash,role FROM Users WHERE email=? LIMIT 1',
      [parsed.data.email.toLowerCase()],
    );
    const row = rows[0];
    if (!row || !(await bcrypt.compare(parsed.data.password, row.password_hash))) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    const user = { id: Number(row.user_id), name: row.name, email: row.email, role: row.role };
    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) { return apiError(error); }
}
