import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/mysql';
import { apiError } from '@/lib/http';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const city = url.searchParams.get('city');
    const search = url.searchParams.get('q')?.trim();
    const where = ['e.date_time>CURRENT_TIMESTAMP'];
    const values: (string | number)[] = [];
    if (city && city !== 'all') { where.push('v.city=?'); values.push(city); }
    if (search) { where.push('(e.title LIKE ? OR e.category LIKE ? OR v.city LIKE ?)'); values.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    const [events] = await pool.execute<RowDataPacket[]>(
      `SELECT e.event_id,e.title,e.category,e.date_time,e.organizer_name,v.name AS venue,v.city
       FROM Events e JOIN Venues v ON v.venue_id=e.venue_id
       WHERE ${where.join(' AND ')} ORDER BY e.date_time`, values,
    );
    if (!events.length) return NextResponse.json({ events: [] });
    const ids = events.map(event => Number(event.event_id));
    const [tickets] = await pool.query<RowDataPacket[]>(
      `SELECT ticket_id,event_id,ticket_type,price,seats_available FROM Tickets WHERE event_id IN (?) ORDER BY price`, [ids],
    );
    return NextResponse.json({ events: events.map(event => ({
      id: Number(event.event_id), title: event.title, category: event.category,
      dateTime: event.date_time, organizer: event.organizer_name, city: event.city, venue: event.venue,
      tickets: tickets.filter(ticket => Number(ticket.event_id) === Number(event.event_id)).map(ticket => ({
        id: Number(ticket.ticket_id), name: ticket.ticket_type, price: Number(ticket.price), seats: Number(ticket.seats_available),
      })),
    })) });
  } catch (error) { return apiError(error); }
}
