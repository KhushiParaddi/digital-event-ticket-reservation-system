# Digital Event Ticket Reservation System

A MySQL mini project for browsing events, checking ticket inventory, booking or cancelling tickets, and tracking payments. It demonstrates normalized relational design, constraints, joins, aggregates, a view, triggers, and transactional booking operations.

## Requirements

- MySQL 8.0 or later (InnoDB, CHECK constraints, and `utf8mb4_0900_ai_ci` collation)
- Any MySQL client, such as MySQL Workbench or the `mysql` command line client

## Run

From this directory, run these files in order:

```sh
mysql -u root -p < 01_schema.sql
mysql -u root -p < 02_sample_data.sql
mysql -u root -p < 03_demo.sql
mysql -u root -p < 04_queries.sql
```

`01_schema.sql` drops and recreates the project tables and view. Do not rerun it if you need to preserve data. Sample passwords are placeholder hashes; authentication is outside the database demo.

## Relational design

The six core tables are Users, Venues, Events, Tickets, Bookings, and Payments. Venue to Event and Event to Ticket are one-to-many. User to Booking and Ticket to Booking are one-to-many. A unique `Payments.booking_id` makes payment-to-booking one-to-one. Foreign keys preserve referential integrity; uniqueness, check constraints, and enums constrain valid values. Each table stores facts about one entity, with references represented by foreign keys.

The schema separates an event from its ticket tiers and a booking from its payment. `Tickets.seats_available` is the remaining inventory for that ticket tier. The trigger set checks capacity before a booking, subtracts inventory on insert, restores it when a booking is cancelled or deleted, and reserves inventory if a cancelled booking is reactivated. Ticket type and quantity become immutable after creation so inventory remains consistent.

## Demonstration

`02_sample_data.sql` loads five users, four venues, five future events, ten ticket tiers, and six bookings with corresponding payments. `03_demo.sql` books two VIP seats and records payment in one transaction, then cancels a sample booking and refunds its payment. A trigger maintains inventory during each operation. `04_queries.sql` provides upcoming-city listings, booking history, per-event paid revenue, top booked events, venue inventory occupancy, pending payers, and a joined booking report.

The occupancy query compares remaining ticket inventory with venue capacity. For the percentage to represent actual venue occupancy, organizers should allocate ticket tiers whose total seats equal the venue's event capacity. Payments are database records for demonstration; no payment gateway is connected.
## Optional front end

Open `index.html` in a modern browser to use the barebones event browsing demo. Visitors can filter by city, select a ticket tier, book up to eight tickets, view bookings, and cancel a booking. Demo bookings and inventory are saved in that browser's local storage. The front end does not connect to MySQL and does not process real payments; use the SQL scripts separately to demonstrate the database layer.
