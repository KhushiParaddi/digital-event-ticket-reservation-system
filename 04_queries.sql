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
SELECT v.venue_id,v.name AS venue,v.city,v.total_capacity,e.title AS event,
       COALESCE(SUM(t.seats_available),0) AS seats_available,
       COALESCE(SUM(t.seat_capacity-t.seats_available),0) AS tickets_booked,
       ROUND(100*COALESCE(SUM(t.seat_capacity-t.seats_available),0)/v.total_capacity,2) AS occupancy_percent
FROM Venues v
JOIN Events e ON e.venue_id=v.venue_id
LEFT JOIN Tickets t ON t.event_id=e.event_id
GROUP BY v.venue_id,v.name,v.city,v.total_capacity,e.event_id,e.title;

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

-- 8. Nested query: customers with at least one pending payment.
SELECT user_id,name,email
FROM Users
WHERE user_id IN (
  SELECT b.user_id FROM Bookings b
  JOIN Payments p ON p.booking_id=b.booking_id
  WHERE p.payment_status='PENDING'
);

-- 9. Correlated query: show each event with its paid revenue.
SELECT e.event_id,e.title,
       (SELECT COALESCE(SUM(p.amount),0)
        FROM Tickets t JOIN Bookings b ON b.ticket_id=t.ticket_id
        JOIN Payments p ON p.booking_id=b.booking_id
        WHERE t.event_id=e.event_id AND b.status<>'CANCELLED' AND p.payment_status='PAID') AS revenue
FROM Events e;

-- 10. Recursive CTE: walk the category tree from top-level categories down.
WITH RECURSIVE category_tree AS (
  SELECT category_id,parent_category_id,name,0 AS depth,
         CAST(name AS CHAR(1000)) AS path
  FROM Categories WHERE parent_category_id IS NULL
  UNION ALL
  SELECT c.category_id,c.parent_category_id,c.name,ct.depth+1,
         CONCAT(ct.path,' > ',c.name)
  FROM Categories c JOIN category_tree ct ON c.parent_category_id=ct.category_id
)
SELECT category_id,parent_category_id,name,depth,path
FROM category_tree ORDER BY path;

-- 11. CTE: rank events by successful ticket revenue.
WITH paid_event_revenue AS (
  SELECT e.event_id,e.title,fn_event_revenue(e.event_id) AS revenue
  FROM Events e
)
SELECT event_id,title,revenue,
       DENSE_RANK() OVER (ORDER BY revenue DESC) AS revenue_rank
FROM paid_event_revenue ORDER BY revenue_rank,title;

-- 12. DML examples: modify organizer contact details, then remove a disposable row.
UPDATE Users SET phone='9876500099' WHERE email='aarav@example.com';
INSERT INTO Users(name,email,password_hash) VALUES('Delete Query Demo','delete-query@example.com','not-a-login-hash');
DELETE FROM Users WHERE email='delete-query@example.com';
