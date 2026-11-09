import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '@/lib/mysql';
import { createSession } from '@/lib/auth';
import { apiError, sameOrigin, validationError } from '@/lib/http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(72).refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be no more than 72 UTF-8 bytes.'),
});

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? 'Invalid registration details');
    const { name, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const [insert] = await pool.execute<ResultSetHeader>(
      "INSERT INTO Users(name,email,password_hash,role) VALUES(?,?,?,'CUSTOMER')",
      [name, email.toLowerCase(), passwordHash],
    );
    const user = { id: insert.insertId, name, email: email.toLowerCase(), role: 'CUSTOMER' as const };
    await createSession(user);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) { return apiError(error); }
}
