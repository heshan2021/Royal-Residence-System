# Royal Residence - Receptionist Dashboard

A modern, glassmorphic single-page web application built with **Next.js (App Router)**, **Tailwind CSS**, and **lucide-react** for managing guest house room reservations and check-ins/check-outs in real-time.

## 🎨 Design Highlights

- **Glassmorphic UI**: Semi-transparent backgrounds with backdrop blur effects, subtle white borders, and soft shadows
- **Modern Gradient Background**: Deep slate to soft blue/purple gradient that creates visual depth
- **Responsive Design**: Optimized for tablets and desktop screens with a mobile-first approach
- **Dark Theme**: High contrast white text on dark backgrounds with color-coded status indicators

## 🚀 Features

### Dashboard View
- **7 Pre-configured Rooms** with specific amenities and pricing
- **Real-time Status Display** with color-coded room availability
- **Statistics Panel** showing total rooms, available rooms, and occupied rooms
- **Responsive Grid Layout** that adapts to different screen sizes

### Check-In Flow
- Click any available room to trigger the check-in modal
- Form validation for guest information:
  - Guest Name
  - Phone Number
  - NIC (National Identity Card) Number
  - Check-In Time (auto-populated with current time)
  - Expected Check-Out Time
- Room status changes to occupied (red) with guest details displayed on the card

### Check-Out Flow
- Click any occupied room to trigger the check-out modal
- Display current guest information in read-only mode
- One-click check-out confirmation
- Room returns to available (green) status and fully clears guest data

### Room Management
- **Room 301**: Permanently occupied by family friend (non-interactive, always red)
- **Room 302**: 5000 LKR, No Balcony
- **Room 303**: 5500 LKR, Has Balcony
- **Room 201**: Master Bedroom, Custom Pricing, Large Room, Bathtub, Balcony
- **Room 202**: 5000 LKR, No Balcony
- **Room 203**: 5500 LKR, Has Balcony
- **Room 101**: 4500 LKR, No Balcony

## 📁 Project Structure

```
app/
├── page.tsx                 # Main dashboard component with state management
├── components/
│   ├── RoomCard.tsx        # Individual room card component
│   ├── CheckInModal.tsx    # Check-in form modal
│   └── CheckOutModal.tsx   # Check-out confirmation modal
├── layout.tsx              # Root layout wrapper
└── globals.css             # Global styles and Tailwind configuration
```

## 🛠️ Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **lucide-react** - Modern icon library
- **React Hooks** - State management (useState, useCallback)

## 📦 Installation & Setup

1. **Navigate to project directory:**
   ```bash
   cd receptionist-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 🔧 Development

### Build for Production
```bash
npm run build
npm run start
```

### Run ESLint
```bash
npm run lint
```

## 📝 Component Details

### RoomCard Component
- Displays room number, price, and amenities
- Color-coded based on occupancy status
- Shows guest checkout time when occupied
- Hover effects for better interactivity
- Icon indicators for amenities (Bathtub, Balcony status, Large room)

### CheckInModal Component
- Glassmorphic modal with form validation
- Real-time error display
- Auto-populated check-in time
- Confirms guest data before check-in
- Close button and cancel option

### CheckOutModal Component
- Read-only display of current guest information
- Confirmation modal before finalizing check-out
- One-click room clearing
- Guest details clearly visible

## 🎯 Current State Management

The application uses **React `useState`** for local state management:
- `rooms`: Array of room objects with occupancy status and guest details
- `selectedRoom`: Currently selected room for modal interaction
- `modalType`: Determines which modal to display ('checkin' or 'checkout')

### Mock Data Structure
Each room object contains:
```typescript
{
  id: string;              // Unique room identifier
  number: string;          // Room number for display
  price: number | string;  // Room price in LKR
  amenities: string[];     // Array of amenities
  isOccupied: boolean;     // Occupancy status
  checkOutTime?: string;   // Expected check-out time
  guestName?: string;      // Guest name
  phoneNumber?: string;    // Guest phone number
  nicNumber?: string;      // Guest NIC number
}
```

## 🚀 Future Enhancements

- **Supabase Integration**: Replace mock state with real database
- **User Authentication**: Add login/logout for receptionist accounts
- **Guest History**: View past check-ins and check-outs
- **Room Photos**: Add image gallery for each room
- **Payment Integration**: Track payments and billing
- **Export Reports**: Generate daily/weekly occupancy reports
- **SMS Notifications**: Send check-out reminders to guests
- **Multi-language Support**: Support for Sinhala and Tamil

## 🔐 Deployment

Ready for deployment on **Vercel**:

1. Push code to GitHub repository
2. Connect repository to Vercel
3. Vercel will auto-detect Next.js and deploy
4. Easy environment variable management for future Supabase integration

## 📞 Support

For issues or questions, refer to:
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [lucide-react Icon Library](https://lucide.dev)

---

**Version**: 1.0.0  
**Last Updated**: March 20, 2026  
**Status**: Production Ready (Mock Data)
