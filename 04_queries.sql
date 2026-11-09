USE event_ticket_reservation;

-- 1. Upcoming events with remaining tickets in a city (change city as needed).
SET @city = 'Bengaluru';
SELECT title, category, date_time, ticket_type, price, seats_available
FROM available_tickets_per_event
WHERE city=@city
ORDER BY date_time, price;

-- 2. A user's booking history with event, venue and payment status.
SET @user_id = 1;
SELECT b.booking_id,u.name,e.title,v.name AS venue,v.city,b.booking_date,
       t.ticket_type,b.quantity,b.status AS booking_status,p.amount,p.payment_status
FROM Bookings b
JOIN Users u ON u.user_id=b.user_id
JOIN Tickets t ON t.ticket_id=b.ticket_id
JOIN Events e ON e.event_id=t.event_id
JOIN Venues v ON v.venue_id=e.venue_id
LEFT JOIN Payments p ON p.booking_id=b.booking_id
WHERE b.user_id=@user_id
ORDER BY b.booking_date DESC;

-- 3. Total successful revenue per event.
SELECT e.event_id,e.title,COALESCE(SUM(CASE WHEN p.payment_status='PAID' THEN p.amount ELSE 0 END),0) AS total_revenue
FROM Events e
LEFT JOIN Tickets t ON t.event_id=e.event_id
LEFT JOIN Bookings b ON b.ticket_id=t.ticket_id AND b.status<>'CANCELLED'
LEFT JOIN Payments p ON p.booking_id=b.booking_id
GROUP BY e.event_id,e.title
ORDER BY total_revenue DESC;

-- 4. Top five events by tickets booked, excluding cancelled bookings.
SELECT e.event_id,e.title,SUM(b.quantity) AS tickets_booked
FROM Events e JOIN Tickets t ON t.event_id=e.event_id
JOIN Bookings b ON b.ticket_id=t.ticket_id
WHERE b.status<>'CANCELLED'
GROUP BY e.event_id,e.title
ORDER BY tickets_booked DESC,e.title
LIMIT 5;

-- 5. Occupancy per venue, calculated from all ticket allocations and active bookings.
SELECT v.venue_id,v.name,v.city,v.total_capacity,
       COALESCE(SUM(t.seats_available),0) AS seats_available,
       COALESCE(SUM(t.seats_available),0) AS seats_left_in_ticket_pool,
       ROUND(100*(v.total_capacity-COALESCE(SUM(t.seats_available),0))/v.total_capacity,2) AS occupancy_percent
FROM Venues v
LEFT JOIN Events e ON e.venue_id=v.venue_id
LEFT JOIN Tickets t ON t.event_id=e.event_id
GROUP BY v.venue_id,v.name,v.city,v.total_capacity;

-- 6. Users with pending payment records.
SELECT DISTINCT u.user_id,u.name,u.email
FROM Users u JOIN Bookings b ON b.user_id=u.user_id
JOIN Payments p ON p.booking_id=b.booking_id
WHERE p.payment_status='PENDING' AND b.status<>'CANCELLED';

-- 7. All bookings with customer, event, venue and payment status.
SELECT b.booking_id,u.name,e.title,v.name AS venue,b.quantity,b.status,p.payment_status
FROM Bookings b JOIN Users u ON u.user_id=b.user_id
JOIN Tickets t ON t.ticket_id=b.ticket_id
JOIN Events e ON e.event_id=t.event_id
JOIN Venues v ON v.venue_id=e.venue_id
LEFT JOIN Payments p ON p.booking_id=b.booking_id;
