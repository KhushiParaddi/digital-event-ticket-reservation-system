import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import { currentUser } from '@/lib/auth';
import { pool } from '@/lib/mysql';
import { apiError, sameOrigin, validationError } from '@/lib/http';

export const runtime = 'nodejs';
const bookingSchema = z.object({ ticketId: z.number().int().positive(), quantity: z.number().int().min(1).max(8), paymentMode: z.enum(['CARD','UPI','NET_BANKING','CASH','OTHER']) });
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in to see bookings.' }, { status: 401 });
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.booking_id,b.quantity,b.status,b.booking_date,t.ticket_type,t.price,e.title,e.date_time,v.city,p.payment_status,p.amount
       FROM Bookings b JOIN Tickets t ON t.ticket_id=b.ticket_id JOIN Events e ON e.event_id=t.event_id
       JOIN Venues v ON v.venue_id=e.venue_id LEFT JOIN Payments p ON p.booking_id=b.booking_id
       WHERE b.user_id=? ORDER BY b.booking_date DESC`, [user.id],
    );
    return NextResponse.json({ bookings: rows.map(row => ({
      id: Number(row.booking_id), quantity: Number(row.quantity), status: row.status,
      bookingDate: row.booking_date, ticketType: row.ticket_type, price: Number(row.price),
      event: row.title, dateTime: row.date_time, city: row.city,
      paymentStatus: row.payment_status, amount: Number(row.amount ?? 0),
    })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Sign in before booking tickets.' }, { status: 401 });
    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? 'Invalid booking');
    const connection = await pool.getConnection();
    try {
      await connection.query('CALL sp_create_booking(?,?,?,?,@created_booking_id)', [user.id,parsed.data.ticketId,parsed.data.quantity,parsed.data.paymentMode]);
      const [rows] = await connection.query<RowDataPacket[]>('SELECT @created_booking_id AS booking_id');
      return NextResponse.json({ bookingId: Number(rows[0].booking_id) }, { status: 201 });
    } finally { connection.release(); }
  } catch (error) { return apiError(error); }
}
