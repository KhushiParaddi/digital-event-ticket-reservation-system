import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { currentUser } from '@/lib/auth';
import { pool } from '@/lib/mysql';
import { apiError, sameOrigin, validationError } from '@/lib/http';

export const runtime = 'nodejs';
const schema = z.object({
  title: z.string().trim().min(3).max(200), category: z.enum(['Music','Conference','Comedy','Festival']),
  dateTime: z.string().datetime(), venueId: z.number().int().positive(), organizer: z.string().trim().min(2).max(160),
  tickets: z.array(z.object({ name:z.string().trim().min(1).max(80), price:z.number().min(0).max(1000000), seats:z.number().int().positive().max(100000) })).min(1).max(10),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Organizer access required.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? 'Invalid event');
  const data = parsed.data;
  if (new Date(data.dateTime).getTime() <= Date.now()) return validationError('Event date must be in the future.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [category] = await connection.execute<RowDataPacket[]>('SELECT category_id FROM Categories WHERE name=?', [data.category]);
    if (!category[0]) { await connection.rollback(); return validationError('Unknown category.'); }
    const [event] = await connection.execute<ResultSetHeader>(
      'INSERT INTO Events(title,category,category_id,date_time,venue_id,organizer_name) VALUES(?,?,?,?,?,?)',
      [data.title,data.category,category[0].category_id,new Date(data.dateTime),data.venueId,data.organizer],
    );
    for (const ticket of data.tickets) {
      await connection.execute('INSERT INTO Tickets(event_id,ticket_type,price,seat_capacity,seats_available) VALUES(?,?,?,?,?)', [event.insertId,ticket.name,ticket.price,ticket.seats,ticket.seats]);
    }
    await connection.commit();
    return NextResponse.json({ eventId: event.insertId }, { status: 201 });
  } catch (error) { await connection.rollback(); return apiError(error); }
  finally { connection.release(); }
}
