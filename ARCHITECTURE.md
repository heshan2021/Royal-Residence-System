# 🏗️ Architecture & Code Guide

## Project Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Dashboard (page.tsx)                     │  │
│  │  Central State Management & Logic Orchestration  │  │
│  │  - useState for rooms                            │  │
│  │  - Modal type state                              │  │
│  │  - Check-in/Check-out handlers                   │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                │
│        ┌───────────────┼───────────────┐                │
│        ↓               ↓               ↓                │
│  ┌──────────┐   ┌───────────────┐  ┌──────────────┐   │
│  │ RoomCard │   │ CheckInModal   │  │ CheckOut     │   │
│  │Component │   │ Component      │  │ Modal Comp.  │   │
│  └──────────┘   └───────────────┘  └──────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Tailwind CSS + Glassmorphic Design      │  │
│  │  - Backdrop blur effects                         │  │
│  │  - Semi-transparent backgrounds                  │  │
│  │  - Responsive grid system                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Component Responsibilities

### Dashboard Component (page.tsx)
**Primary Responsibility**: State orchestration and business logic

```typescript
Key Responsibilities
├── Initialize room data (INITIAL_ROOMS)
├── Manage room state (useState)
├── Handle room click events
├── Process check-in flow
├── Process check-out flow
├── Track modal visibility
├── Calculate statistics (occupied, available)
└── Render UI with all components
```

**State Structure**:
```typescript
[rooms] - Array<Room>           // All room data
[selectedRoom] - Room | null    // Currently selected room
[modalType] - 'checkin' | 'checkout' | null  // Active modal
```

### RoomCard Component
**Primary Responsibility**: Display individual room status

**Props**:
```typescript
{
  room: Room,              // Room object to display
  onClick: () => void      // Triggered on card click
}
```

**Features**:
- Glassmorphic styling based on occupancy
- Color-coded status (green/red)
- Icon display for amenities
- Guest info display when occupied
- Responsive layout

---

## 🔄 Data Flow

### Check-In Sequence

```
User clicks Available Room
    ↓
handleRoomClick(room) called
    ↓
Set selectedRoom = room
Set modalType = 'checkin'
    ↓
CheckInModal Renders
    ↓
User fills form & clicks "Confirm"
    ↓
handleCheckIn(formData) called
    ↓
setRooms() updates room state:
  - isOccupied = true
  - guestName = formData.guestName
  - phoneNumber = formData.phoneNumber
  - nicNumber = formData.nicNumber
  - checkOutTime = formData.checkOutTime
    ↓
Modal closes
    ↓
RoomCard re-renders with RED status
Dashboard updates statistics
```

### Check-Out Sequence

```
User clicks Occupied Room
    ↓
handleRoomClick(room) called
    ↓
Set selectedRoom = room
Set modalType = 'checkout'
    ↓
CheckOutModal Renders (read-only guest info)
    ↓
User clicks "Confirm Check-Out"
    ↓
handleCheckOut() called
    ↓
setRooms() updates room state:
  - isOccupied = false
  - guestName = undefined
  - phoneNumber = undefined
  - nicNumber = undefined
  - checkOutTime = undefined
    ↓
Modal closes
    ↓
RoomCard re-renders with GREEN status
Dashboard updates statistics
```

---

## 🎨 Glassmorphic Design Pattern

### Core Principles

```css
/* Base Glass Effect */
.glassmorphic {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Color Variations */
.glass-green {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  box-shadow: 0 4px 6px rgba(34, 197, 94, 0.1);
}

.glass-red {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);
}
```

### Tailwind Implementation

```typescript
// Available Room
className="backdrop-blur-xl bg-white/10 border-white/20 shadow-lg shadow-white/10"

// Occupied Room  
className="backdrop-blur-xl bg-red-500/20 border-red-300/30 shadow-lg shadow-red-500/20"

// Modal Backdrop
className="fixed inset-0 bg-black/50 backdrop-blur-sm"
```

---

## 📊 Type Definitions

### Room Interface

```typescript
interface Room {
  id: string;              // Unique identifier
  number: string;          // Display number (e.g., "301")
  price: number | string;  // Room price or "Custom"
  amenities: string[];     // Features like "Balcony", "Bathtub"
  isOccupied: boolean;     // Current occupancy status
  checkOutTime?: string;   // Expected checkout (optional)
  guestName?: string;      // Current guest (optional)
  phoneNumber?: string;    // Guest phone (optional)
  nicNumber?: string;      // Guest NIC/ID (optional)
}
```

### CheckInData Interface

```typescript
interface CheckInData {
  guestName: string;       // Required
  phoneNumber: string;     // Required
  nicNumber: string;       // Required
  checkInTime: string;     // Time format
  checkOutTime: string;    // Time format, required
}
```

---

## 🔍 Key Features Implementation

### 1. Form Validation

```typescript
// In CheckInModal.tsx
const validateForm = (): boolean => {
  const newErrors: Partial<CheckInData> = {};
  
  if (!formData.guestName.trim()) 
    newErrors.guestName = 'Guest name is required';
  // ... more validations
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### 2. Responsive Grid

```typescript
// In page.tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* 1 column mobile, 2 columns tablet, 4 columns desktop */}
</div>
```

### 3. Color Coding

```typescript
// In RoomCard.tsx
className={
  room.isOccupied 
    ? 'bg-red-500/20 border-red-300/30'  // Occupied
    : 'bg-white/10 border-white/20'      // Available
}
```

### 4. Permanent Room Protection

```typescript
// In page.tsx
const handleRoomClick = useCallback((room: Room) => {
  if (room.id === 'room-301') return; // Prevent interaction
  // ... rest of logic
}, []);
```

---

## ✅ Testing Scenarios

### Scenario 1: Check-In Flow
```
1. Click Room 302 (green)
2. Fill all form fields
3. Click "Confirm Check-In"
4. Verify: Room turns red, guest info appears
5. Statistics: Available goes down, Occupied goes up
```

### Scenario 2: Check-Out Flow
```
1. Click previously checked-in room (red)
2. Review guest information (read-only)
3. Click "Confirm Check-Out"
4. Verify: Room turns green, guest info clears
5. Statistics: Available goes up, Occupied goes down
```

### Scenario 3: Form Validation
```
1. Click available room
2. Click "Confirm Check-In" without filling fields
3. Verify: Error messages appear under each field
4. Fill fields and resubmit
5. Verify: Check-in completes successfully
```

### Scenario 4: Room 301 Protection
```
1. Attempt to click Room 301
2. Verify: Nothing happens (non-interactive)
3. Always shows as red/occupied
4. Cannot modify status
```

---

## 🔧 Modification Guide

### To Add a New Room

```typescript
// In page.tsx - INITIAL_ROOMS array
{
  id: 'room-102',
  number: '102',
  price: 4500,
  amenities: ['No Balcony'],
  isOccupied: false,
}
```

### To Change Room Pricing

```typescript
// Simply update the price value
{
  id: 'room-303',
  number: '303',
  price: 6000,  // Changed from 5500
  // ... rest
}
```

### To Modify Glassmorphic Colors

```typescript
// In RoomCard.tsx
className={`backdrop-blur-xl ... ${
  room.isOccupied
    ? 'bg-purple-500/20 border-purple-300/30'  // New color
    : 'bg-white/10 border-white/20'
}`}
```

### To Add New Amenities

```typescript
// In RoomCard.tsx - add new icon check
{room.amenities.includes('Parking') && (
  <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
    <ParkingCircle size={16} className="text-yellow-300" />
    <span className="text-xs text-yellow-100">Parking</span>
  </div>
)}
```

---

## 📦 Dependencies Used

```json
{
  "next": "^16.2.0",        // React framework
  "react": "^19",           // UI library
  "react-dom": "^19",       // DOM rendering
  "tailwindcss": "^4.x",    // Styling
  "lucide-react": "latest"  // Icons
}
```

**Why these?**
- Next.js: Full routing, optimization, deployment
- React: Component-based UI, hooks
- Tailwind: Rapid UI development, responsive design
- lucide-react: Consistent, scalable icons

---

## 🚀 Performance Considerations

### Current Optimizations
- ✅ Component memoization with `useCallback`
- ✅ Minimal re-renders with React hooks
- ✅ Tailwind CSS (optimized at build time)
- ✅ lucide-react (tree-shakeable)
- ✅ Next.js Image optimization (when needed)

### Future Optimizations
- Add `React.memo()` for RoomCard components
- Implement pagination for many rooms
- Use Suspense for modal loading
- Add code splitting for components

---

## 🔐 Security Notes

### Current Scope
- Client-side only (no API calls)
- No authentication required (mock data)
- No sensitive data storage
- Form data not persisted

### Before Production
- Add user authentication
- Implement backend API validation
- Add HTTPS/TLS encryption
- Sanitize all user inputs
- Add rate limiting
- Implement audit logs
- Add role-based access control

---

## 📞 Questions?

Refer to individual component files for inline code comments and explanations:
- `app/page.tsx` - Main logic
- `app/components/RoomCard.tsx` - Card display
- `app/components/CheckInModal.tsx` - Check-in form
- `app/components/CheckOutModal.tsx` - Check-out confirmation

Each file has detailed comments explaining the code.

---

*Architecture Document v1.0*  
*Last Updated: March 20, 2026*
