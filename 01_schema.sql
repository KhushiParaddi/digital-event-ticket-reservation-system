-- Digital Event Ticket Reservation System
-- MySQL 8.0+ | Run in order: 01_schema.sql, 02_sample_data.sql, 03_demo.sql, 04_queries.sql
CREATE DATABASE IF NOT EXISTS event_ticket_reservation
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE event_ticket_reservation;

DROP PROCEDURE IF EXISTS sp_cancel_booking;
DROP PROCEDURE IF EXISTS sp_create_booking;
DROP FUNCTION IF EXISTS fn_event_revenue;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS available_tickets_per_event;
DROP TABLE IF EXISTS Payments;
DROP TABLE IF EXISTS Bookings;
DROP TABLE IF EXISTS Tickets;
DROP TABLE IF EXISTS Events;
DROP TABLE IF EXISTS Venues;
DROP TABLE IF EXISTS Categories;
DROP TABLE IF EXISTS Users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('CUSTOMER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Categories (
  category_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_category_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL UNIQUE,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id) REFERENCES Categories(category_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Venues (
  venue_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  total_capacity INT UNSIGNED NOT NULL,
  CONSTRAINT chk_venue_capacity CHECK (total_capacity > 0),
  UNIQUE KEY uq_venue_name_city (name, city)
) ENGINE=InnoDB;

CREATE TABLE Events (
  event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  date_time DATETIME NOT NULL,
  venue_id BIGINT UNSIGNED NOT NULL,
  organizer_name VARCHAR(160) NOT NULL,
  CONSTRAINT fk_events_venue FOREIGN KEY (venue_id) REFERENCES Venues(venue_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES Categories(category_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_events_datetime (date_time),
  KEY idx_events_venue (venue_id)
) ENGINE=InnoDB;

CREATE TABLE Tickets (
  ticket_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  ticket_type VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  seat_capacity INT UNSIGNED NOT NULL,
  seats_available INT UNSIGNED NOT NULL,
  CONSTRAINT chk_ticket_price CHECK (price >= 0),
  CONSTRAINT chk_ticket_inventory CHECK (seat_capacity > 0 AND seats_available <= seat_capacity),
  CONSTRAINT fk_tickets_event FOREIGN KEY (event_id) REFERENCES Events(event_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE KEY uq_event_ticket_type (event_id, ticket_type),
  KEY idx_tickets_event_available (event_id, seats_available)
) ENGINE=InnoDB;

CREATE TABLE Bookings (
  booking_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ticket_id BIGINT UNSIGNED NOT NULL,
  booking_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('PENDING','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  CONSTRAINT chk_booking_quantity CHECK (quantity > 0),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_ticket FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_bookings_user_date (user_id, booking_date),
  KEY idx_bookings_ticket_status (ticket_id, status)
) ENGINE=InnoDB;

CREATE TABLE Payments (
  payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  payment_mode ENUM('CARD','UPI','NET_BANKING','CASH','OTHER') NOT NULL,
  payment_status ENUM('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  payment_date TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT chk_payment_amount CHECK (amount >= 0),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER tickets_before_insert
BEFORE INSERT ON Tickets FOR EACH ROW
BEGIN
  DECLARE v_event_capacity INT UNSIGNED DEFAULT NULL;
  DECLARE v_allocated INT UNSIGNED DEFAULT 0;
  SELECT v.total_capacity INTO v_event_capacity
  FROM Events e JOIN Venues v ON v.venue_id=e.venue_id
  WHERE e.event_id=NEW.event_id;
  SELECT COALESCE(SUM(seat_capacity),0) INTO v_allocated
  FROM Tickets WHERE event_id=NEW.event_id;
  IF v_event_capacity IS NULL OR v_allocated+NEW.seat_capacity>v_event_capacity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket tiers exceed venue capacity';
  END IF;
END$$

CREATE TRIGGER tickets_before_update
BEFORE UPDATE ON Tickets FOR EACH ROW
BEGIN
  DECLARE v_event_capacity INT UNSIGNED DEFAULT NULL;
  DECLARE v_allocated INT UNSIGNED DEFAULT 0;
  IF NEW.event_id<>OLD.event_id OR NEW.seat_capacity<>OLD.seat_capacity THEN
    SELECT v.total_capacity INTO v_event_capacity
    FROM Events e JOIN Venues v ON v.venue_id=e.venue_id
    WHERE e.event_id=NEW.event_id;
    SELECT COALESCE(SUM(seat_capacity),0) INTO v_allocated
    FROM Tickets WHERE event_id=NEW.event_id AND ticket_id<>OLD.ticket_id;
    IF v_event_capacity IS NULL OR v_allocated+NEW.seat_capacity>v_event_capacity THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket tiers exceed venue capacity';
    END IF;
  END IF;
END$$

CREATE TRIGGER bookings_before_insert
BEFORE INSERT ON Bookings FOR EACH ROW
BEGIN
  DECLARE v_available INT UNSIGNED DEFAULT NULL;
  IF NEW.quantity = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking quantity must be positive';
  END IF;
  IF NEW.status <> 'CANCELLED' THEN
    SELECT seats_available INTO v_available FROM Tickets
      WHERE ticket_id = NEW.ticket_id FOR UPDATE;
    IF v_available IS NULL OR v_available < NEW.quantity THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough seats available';
    END IF;
  END IF;
END$$

CREATE TRIGGER bookings_after_insert
AFTER INSERT ON Bookings FOR EACH ROW
BEGIN
  IF NEW.status <> 'CANCELLED' THEN
    UPDATE Tickets SET seats_available = seats_available - NEW.quantity
      WHERE ticket_id = NEW.ticket_id;
  END IF;
END$$

CREATE TRIGGER bookings_before_update
BEFORE UPDATE ON Bookings FOR EACH ROW
BEGIN
  DECLARE v_available INT UNSIGNED DEFAULT NULL;
  IF NEW.quantity = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking quantity must be positive';
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    SELECT seats_available INTO v_available FROM Tickets
      WHERE ticket_id = NEW.ticket_id FOR UPDATE;
    IF v_available IS NULL OR v_available < NEW.quantity THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough seats available to reactivate booking';
    END IF;
  END IF;
  IF OLD.ticket_id <> NEW.ticket_id OR OLD.quantity <> NEW.quantity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ticket and quantity cannot be changed after booking';
  END IF;
END$$

CREATE TRIGGER bookings_after_update
AFTER UPDATE ON Bookings FOR EACH ROW
BEGIN
  IF OLD.status <> 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
    UPDATE Tickets SET seats_available = seats_available + OLD.quantity
      WHERE ticket_id = OLD.ticket_id;
  ELSEIF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    UPDATE Tickets SET seats_available = seats_available - NEW.quantity
      WHERE ticket_id = NEW.ticket_id;
  END IF;
END$$

CREATE TRIGGER bookings_after_delete
AFTER DELETE ON Bookings FOR EACH ROW
BEGIN
  IF OLD.status <> 'CANCELLED' THEN
    UPDATE Tickets SET seats_available = seats_available + OLD.quantity
      WHERE ticket_id = OLD.ticket_id;
  END IF;
END$$
DELIMITER ;

CREATE VIEW available_tickets_per_event AS
SELECT e.event_id, e.title, e.category, e.date_time, v.city,
       t.ticket_id, t.ticket_type, t.price, t.seats_available
FROM Events e
JOIN Venues v ON v.venue_id = e.venue_id
JOIN Tickets t ON t.event_id = e.event_id
WHERE e.date_time > CURRENT_TIMESTAMP AND t.seats_available > 0;

DELIMITER $$
CREATE FUNCTION fn_event_revenue(p_event_id BIGINT UNSIGNED)
RETURNS DECIMAL(12,2)
NOT DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE v_revenue DECIMAL(12,2) DEFAULT 0.00;
  SELECT COALESCE(SUM(p.amount),0.00) INTO v_revenue
  FROM Payments p
  JOIN Bookings b ON b.booking_id=p.booking_id AND b.status<>'CANCELLED'
  JOIN Tickets t ON t.ticket_id=b.ticket_id
  WHERE t.event_id=p_event_id AND p.payment_status='PAID';
  RETURN v_revenue;
END$$

CREATE PROCEDURE sp_create_booking(
  IN p_user_id BIGINT UNSIGNED,
  IN p_ticket_id BIGINT UNSIGNED,
  IN p_quantity INT UNSIGNED,
  IN p_payment_mode VARCHAR(20),
  OUT p_booking_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_price DECIMAL(10,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  SELECT price INTO v_price FROM Tickets WHERE ticket_id=p_ticket_id FOR UPDATE;
  IF v_price IS NULL OR p_quantity IS NULL OR p_quantity=0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid ticket or booking quantity';
  END IF;
  INSERT INTO Bookings(user_id,ticket_id,quantity,status)
  VALUES(p_user_id,p_ticket_id,p_quantity,'CONFIRMED');
  SET p_booking_id=LAST_INSERT_ID();
  INSERT INTO Payments(booking_id,amount,payment_mode,payment_status,payment_date)
  VALUES(p_booking_id,v_price*p_quantity,p_payment_mode,'PAID',CURRENT_TIMESTAMP);
  COMMIT;
END$$

CREATE PROCEDURE sp_cancel_booking(
  IN p_booking_id BIGINT UNSIGNED,
  IN p_user_id BIGINT UNSIGNED,
  IN p_is_admin BOOLEAN
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  UPDATE Bookings
  SET status='CANCELLED'
  WHERE booking_id=p_booking_id AND status<>'CANCELLED'
    AND (user_id=p_user_id OR p_is_admin=TRUE);
  IF ROW_COUNT()=0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking not found or already cancelled';
  END IF;
  UPDATE Payments
  SET payment_status=CASE WHEN payment_status='PAID' THEN 'REFUNDED' WHEN payment_status='PENDING' THEN 'FAILED' ELSE payment_status END,
      payment_date=CURRENT_TIMESTAMP
  WHERE booking_id=p_booking_id AND payment_status IN ('PAID','PENDING');
  COMMIT;
END$$
DELIMITER ;
