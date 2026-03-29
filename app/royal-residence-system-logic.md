Royal Residence: System Architecture & Front Desk Workflow (V3)
1. Core Philosophy: "The Night Slot"
The Royal Residence does not operate on a 24-hour clock. Inventory is sold strictly as "Night Slots".

Check-In (Slot Opens): 14:00:00 (2:00 PM) Local Sri Lanka Time.

Check-Out (Slot Closes): 11:00:00 (11:00 AM) the following day.

The Turnaround Window: The 3-hour gap (11:00 AM to 2:00 PM) is dedicated to housekeeping.

Immutable System Rule: The UI should never ask the receptionist or the guest to input times. The system purely relies on Dates (YYYY-MM-DD). The backend automatically appends the 14:00 and 11:00 timestamps to enforce the Turnaround Window and calculate overlaps.

2. Frontend Architecture: Strict Separation of Concerns
The application is divided into two heavily isolated environments to protect admin data and ensure a premium public experience.

Environment A: The Admin PMS (Internal Front Desk)
Location: app/(admin)/... or app/dashboard/...

Purpose: High-speed command center for the receptionist.

Design: Dense, functional, utility-first UI.

Environment B: The Guest Booking Engine (Public)
Location: app/book/...

Purpose: A luxurious, shareable menu for direct guest bookings.

Design: Premium aesthetic, large imagery, glassmorphism. Isolated from admin layouts.

3. The Receptionist Dashboard: The 3 Room States
The primary Admin Dashboard uses a "Time Machine" date picker. Rooms are rendered as colored cards based on the selected date:

Available (Green): The room has no bookings touching this date. Ready to sell.

Occupied (Red): The selected date falls between a guest's Check-In and Check-Out. Do not touch.

Due Out / Turnaround (Yellow/Orange): The selected date equals a guest's Check-Out Date.

Dual-Action UI: Clicking a "Due Out" card opens a split modal. The top half allows the receptionist to process the departure for the morning guest. The bottom half allows them to book a new guest for the 2:00 PM slot.

4. The Calendar View (Tape Chart)
A read-only grid (Rooms on Y-axis, Dates on X-axis) used for answering phone inquiries.

Availability: Represented purely by blank white space.

Split-Cell Visuals: If two bookings touch on the exact same day (Guest A leaves at 11:00 AM, Guest B arrives at 2:00 PM), they do not overlap vertically. Guest A's block takes the left half (w-1/2) of the cell; Guest B's block takes the right half.

5. Standard Operating Procedures & Workflows
Scenario A: The Direct Walk-In
Logic: Guest arrives at the front desk to book a room.

Action: Receptionist checks the Dashboard View for Green rooms, inputs the guest's requested duration, takes the payment, and saves the booking. The room immediately turns Red.

Scenario B: The Late-Night Walk-In (e.g., 1:00 AM Tuesday)
Logic: The guest is buying the leftovers of Monday's Night Slot.

Action: Receptionist sets the Dashboard date picker to Monday (yesterday) and books the room. The system correctly logs Check-Out for Tuesday at 11:00 AM.

Scenario C: The "WhatsApp Concierge" Online Booking Loop (MVP Checkout)
For V1 of the Guest Engine, we do not use an automated credit card gateway. We use a manual WhatsApp handoff.

Guest Action: Guest browses app/book, selects dates, and clicks "Book Now" on an available room.

System Action: The website prompts for their Name, then generates a wa.me WhatsApp link pre-filled with their requested Room, Check-In, Check-Out, Guests, Total Price, and Name.

The Handoff: This opens WhatsApp on the guest's device, sending the pre-filled text directly to the Royal Residence front desk WhatsApp number.

Receptionist Action: * The receptionist receives the WhatsApp message.

They reply requesting an advance payment via bank transfer to secure the dates.

Crucial Step: Once the guest sends the bank transfer receipt via WhatsApp, the receptionist manually opens the Admin Dashboard, selects the requested room and dates, and saves the booking.

The Result: The system locks the dates, prevents double-booking, and immediately removes that room's availability from the public guest website.

6. Technical Constraints for Developers
Database Schema: checkInDate and checkOutDate must be full timestamp or datetime columns. Never use a simple date type.

Backend Overlap Logic: Drizzle ORM queries must use strict < and > when checking for overlaps: newCheckIn < existingCheckOut AND newCheckOut > existingCheckIn.

Frontend Availability Math: A room is occupied on a selectedDate ONLY IF selectedDate >= booking.checkInDate AND selectedDate < booking.checkOutDate. (Strictly < for checkout).