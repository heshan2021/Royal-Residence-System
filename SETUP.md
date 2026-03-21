# Quick Start Guide - Royal Residence Dashboard

## 🎯 Getting Started

### Prerequisites
- Node.js 18+ installed on your system
- npm or yarn package manager

### Setup Instructions

1. **Navigate to the project folder:**
   ```bash
   cd c:\Users\Gamini Pathirana\OneDrive\Documents\receptionist-dashboard
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in your browser:**
   - If port 3000 is available: `http://localhost:3000`
   - If port 3000 is busy: `http://localhost:3001`
   - The terminal will show you which port is being used

---

## 🏠 Dashboard Overview

### Statistics Panel (Top Section)
- **Total Rooms**: Shows count of all 7 rooms
- **Available**: Green indicator showing rooms ready for check-in
- **Occupied**: Red indicator showing active reservations

### Room Cards (Main Grid)
- 7 glassmorphic cards displayed in a responsive grid
- **Green cards**: Available rooms (clickable for check-in)
- **Red cards**: Occupied rooms or permanent reservations
- **Card Information**:
  - Room number (top)
  - Price in LKR (if applicable)
  - Amenities (Balcony status, Bathtub, Room size)
  - Guest info and checkout time (for occupied rooms)

---

## 🔄 How to Use

### ✅ Check-In Process

1. **Click an Available (Green) Room Card**
   - The Check-In modal will appear

2. **Fill in Guest Information:**
   - Guest Name (required)
   - Phone Number (required)
   - NIC Number (required)
   - Check-In Time (auto-filled with current time, adjustable)
   - Expected Check-Out Time (required)

3. **Validate & Submit:**
   - All required fields will be highlighted if missing
   - Click "Confirm Check-In" to complete

4. **Room Status Updates:**
   - Card turns red (occupied)
   - Guest name and check-out time appear on card
   - Card becomes non-interactive until check-out

### 🚪 Check-Out Process

1. **Click an Occupied (Red) Room Card**
   - The Check-Out modal will appear
   - Shows guest information in read-only format

2. **Review Guest Details:**
   - Guest Name
   - Phone Number
   - NIC Number
   - Scheduled Check-Out Time

3. **Confirm Check-Out:**
   - Click "Confirm Check-Out" button
   - Room is immediately freed and status returns to available

4. **Room Status Updates:**
   - Card turns green (available)
   - All guest information is cleared
   - Card becomes clickable again for new check-ins

---

## 🏘️ Room Details Reference

| Room | Price (LKR) | Amenities | Balcony |
|------|------------|-----------|---------|
| 301  | N/A (Long-term) | Family Friend - NON-INTERACTIVE | — |
| 302  | 5,000 | Standard Room | ❌ |
| 303  | 5,500 | Standard Room | ✅ |
| 201  | Custom | Master Suite, Large Room, Bathtub | ✅ |
| 202  | 5,000 | Standard Room | ❌ |
| 203  | 5,500 | Standard Room | ✅ |
| 101  | 4,500 | Standard Room | ❌ |

**Note**: Room 301 is permanently occupied and cannot be interacted with.

---

## 💾 Data & State

### Current Capabilities
- ✅ Real-time room status updates
- ✅ Guest information storage (in memory)
- ✅ Form validation
- ✅ Multiple simultaneous reservations

### Important Notes
- All data is stored in **browser memory** (resets on page refresh)
- Perfect for testing UI/UX before Supabase integration
- No database persistence in current version

---

## 🔮 Next Steps for Production

### Phase 1: Database Integration
- Replace `useState` with Supabase backend
- Add data persistence
- Implement user authentication

### Phase 2: Enhanced Features
- Guest history and past reservations
- Room photo gallery
- Check-out reminders via SMS
- Payment tracking and invoicing

### Phase 3: Deployment
- Deploy to Vercel
- Configure custom domain
- Set up environment variables for Supabase
- Enable CI/CD pipeline

---

## 🐛 Troubleshooting

### Port Already in Use
```
Error: Port 3000 already in use
Solution: App will automatically use port 3001 instead
```

### Styles Not Loading
```
Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
Restart dev server: npm run dev
```

### Issues After Refresh
```
Data won't persist - this is expected (mock data only)
All rooms reset to initial state
Your test data won't be saved between sessions
```

---

## 📞 Helpful Commands

```bash
# Start development server
npm run dev

# Create production build
npm run build

# Start production build locally
npm start

# Run ESLint
npm run lint

# Open in browser
npm run dev  # then visit http://localhost:3000
```

---

## 🎨 Design System

### Colors
- **Background**: Gradient (slate-900 to purple-900)
- **Cards**: White/10 opacity glassmorphic (white/20 borders)
- **Available**: Green indicators (#22c55e)
- **Occupied**: Red indicators (#ef4444)
- **Text**: White with varying opacity

### Responsive Breakpoints
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 4 columns

---

## 📱 Browser Support

- Modern browsers with ES2020+ support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Optimized

---

**Happy Managing! 🎉**

For more details, see the full [README.md](./README.md)
