USE event_ticket_reservation;

-- Atomic booking and payment: both records commit together or neither does.
START TRANSACTION;
INSERT INTO Bookings (user_id,ticket_id,quantity,status)
VALUES (2,2,2,'CONFIRMED');
SET @new_booking_id = LAST_INSERT_ID();
INSERT INTO Payments (booking_id,amount,payment_mode,payment_status,payment_date)
SELECT @new_booking_id, t.price*2, 'CARD', 'PAID', CURRENT_TIMESTAMP
FROM Tickets t WHERE t.ticket_id=2;
COMMIT;

-- Cancel booking #4 from the sample data; trigger restores its ticket inventory.
START TRANSACTION;
UPDATE Bookings SET status='CANCELLED' WHERE booking_id=4 AND status<>'CANCELLED';
UPDATE Payments SET payment_status=CASE WHEN payment_status='PAID' THEN 'REFUNDED' ELSE 'FAILED' END,
    payment_date=CURRENT_TIMESTAMP
WHERE booking_id=4 AND payment_status IN ('PAID','PENDING');
COMMIT;

-- The trigger-adjusted inventory and cancellation can be reviewed here.
SELECT b.booking_id,b.status,b.quantity,t.ticket_type,t.seats_available,p.payment_status
FROM Bookings b JOIN Tickets t ON t.ticket_id=b.ticket_id
JOIN Payments p ON p.booking_id=b.booking_id
WHERE b.booking_id IN (@new_booking_id,4);

-- A disposable row demonstrates DELETE without touching project sample records.
INSERT INTO Users (name,email,phone,password_hash)
VALUES ('Delete Demo','delete-demo@example.com',NULL,'not-a-login-hash');
DELETE FROM Users WHERE email='delete-demo@example.com';
