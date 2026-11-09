USE event_ticket_reservation;

INSERT INTO Users (name,email,phone,password_hash,role) VALUES
('Aarav Mehta','aarav@example.com','9876500001','$2b$12$sample_hash_aarav','ADMIN'),
('Diya Shah','diya@example.com','9876500002','$2b$12$sample_hash_diya','CUSTOMER'),
('Kabir Rao','kabir@example.com','9876500003','$2b$12$sample_hash_kabir','CUSTOMER'),
('Mira Nair','mira@example.com','9876500004','$2b$12$sample_hash_mira','CUSTOMER'),
('Ishaan Das','ishaan@example.com','9876500005','$2b$12$sample_hash_ishaan','CUSTOMER');

INSERT INTO Venues (name,address,city,total_capacity) VALUES
('Indiranagar Open Arena','100 Feet Road, Indiranagar','Bengaluru',1200),
('Riverside Convention Hall','MG Road','Pune',800),
('Coastal Arts Centre','Beach Road','Chennai',600),
('City Music Grounds','Salt Lake','Kolkata',2000);

INSERT INTO Categories (parent_category_id,name) VALUES (NULL,'Experiences');
SET @experiences_id=LAST_INSERT_ID();
INSERT INTO Categories (parent_category_id,name) VALUES
(@experiences_id,'Arts'),(@experiences_id,'Conference'),(@experiences_id,'Festival');
SET @arts_id=(SELECT category_id FROM Categories WHERE name='Arts');
INSERT INTO Categories (parent_category_id,name) VALUES (@arts_id,'Music'),(@arts_id,'Comedy');

INSERT INTO Events (title,category,category_id,date_time,venue_id,organizer_name) VALUES
('Monsoon Indie Night','Music',(SELECT category_id FROM Categories WHERE name='Music'),DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY),1,'LiveLocal'),
('Design Futures Summit','Conference',(SELECT category_id FROM Categories WHERE name='Conference'),DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 45 DAY),2,'FutureWorks'),
('Chennai Laugh Festival','Comedy',(SELECT category_id FROM Categories WHERE name='Comedy'),DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 DAY),3,'BrightStage'),
('Kolkata Food and Music Fair','Festival',(SELECT category_id FROM Categories WHERE name='Festival'),DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 75 DAY),4,'CityBeat'),
('Pune Jazz Weekend','Music',(SELECT category_id FROM Categories WHERE name='Music'),DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 90 DAY),2,'BlueNote India');

INSERT INTO Tickets (event_id,ticket_type,price,seat_capacity,seats_available) VALUES
(1,'General',499.00,1000,1000),(1,'VIP',1499.00,200,200),
(2,'Standard',799.00,600,600),(2,'Delegate',1999.00,200,200),
(3,'General',399.00,500,500),(3,'Front Row',999.00,100,100),
(4,'Day Pass',599.00,1500,1500),(4,'Weekend Pass',1299.00,500,500),
(5,'General',699.00,600,600),(5,'Lounge',1799.00,200,200);

-- Seed bookings are inserted before matching payments in a single transaction.
START TRANSACTION;
INSERT INTO Bookings (user_id,ticket_id,quantity,status) VALUES
(1,1,2,'CONFIRMED'),(2,4,1,'CONFIRMED'),(3,5,3,'CONFIRMED'),
(4,7,2,'PENDING'),(5,9,2,'CONFIRMED'),(1,6,1,'CANCELLED');
INSERT INTO Payments (booking_id,amount,payment_mode,payment_status,payment_date)
SELECT b.booking_id, b.quantity*t.price, 'UPI',
       CASE WHEN b.status='PENDING' THEN 'PENDING' WHEN b.status='CANCELLED' THEN 'REFUNDED' ELSE 'PAID' END,
       CASE WHEN b.status='PENDING' THEN NULL ELSE b.booking_date END
FROM Bookings b JOIN Tickets t ON t.ticket_id=b.ticket_id;
COMMIT;

