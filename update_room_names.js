// Script to update room names as per requirements
// First room gets "Master Bedroom", others get "Double Bed with AC"

const { db } = require('./src/db');
const { rooms } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

async function updateRoomNames() {
  try {
    console.log('Updating room names...');
    
    // Get all rooms ordered by ID
    const allRooms = await db.select().from(rooms).orderBy(rooms.id);
    
    console.log(`Found ${allRooms.length} rooms`);
    
    // Update first room to "Master Bedroom"
    if (allRooms.length > 0) {
      const firstRoom = allRooms[0];
      await db.update(rooms)
        .set({ 
          name: 'Master Bedroom',
          description: 'Our most luxurious suite featuring a king-sized bed, private balcony, and panoramic views of the city.',
          size: 'Suite',
          image_url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80'
        })
        .where(eq(rooms.id, firstRoom.id));
      console.log(`Updated room ${firstRoom.number} (ID: ${firstRoom.id}) to "Master Bedroom"`);
    }
    
    // Update all other rooms to "Double Bed with AC"
    for (let i = 1; i < allRooms.length; i++) {
      const room = allRooms[i];
      await db.update(rooms)
        .set({ 
          name: 'Double Bed with AC',
          description: 'Comfortable double room with climate control, premium bedding, and modern amenities.',
          size: 'Standard',
          image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
        })
        .where(eq(rooms.id, room.id));
      console.log(`Updated room ${room.number} (ID: ${room.id}) to "Double Bed with AC"`);
    }
    
    console.log('Room names updated successfully!');
    
    // Display final state
    const updatedRooms = await db.select().from(rooms).orderBy(rooms.id);
    console.log('\nFinal room configuration:');
    updatedRooms.forEach(room => {
      console.log(`- ${room.number}: ${room.name} (${room.size})`);
    });
    
  } catch (error) {
    console.error('Error updating room names:', error);
  }
}

// Run the update
updateRoomNames();