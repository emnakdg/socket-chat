const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Static dosyaları serve et
app.use(express.static('public'));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Odalar ve kullanıcıları sakla
const rooms = {};

io.on('connection', (socket) => {
  console.log('🟢 Yeni kullanıcı bağlandı:', socket.id);

  // Odaya katılma
  socket.on('join_room', (data) => {
    const { username, roomId } = data;
    
    // Önceki odadan ayrıl
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
      if (rooms[socket.currentRoom]) {
        rooms[socket.currentRoom].delete(socket.username);
        // Önceki odadaki kullanıcılara bildir
        socket.to(socket.currentRoom).emit('user_left', {
          username: socket.username,
          users: Array.from(rooms[socket.currentRoom])
        });
      }
    }
    
    // Yeni odaya katıl
    socket.join(roomId);
    socket.username = username;
    socket.currentRoom = roomId;
    
    // Oda yoksa oluştur
    if (!rooms[roomId]) {
      rooms[roomId] = new Set();
    }
    
    // Kullanıcıyı odaya ekle
    rooms[roomId].add(username);
    
    // Kullanıcıya başarı mesajı gönder
    socket.emit('join_success', {
      room: roomId,
      username: username,
      users: Array.from(rooms[roomId])
    });
    
    // Diğer kullanıcılara bildir
    socket.to(roomId).emit('user_joined', {
      username: username,
      users: Array.from(rooms[roomId])
    });
    
    // Sistem mesajı gönder
    socket.to(roomId).emit('system_message', `${username} odaya katıldı!`);
    
    console.log(`👤 ${username} -> ${roomId} odasına katıldı`);
  });

  // Mesaj gönderme
  socket.on('send_message', (data) => {
    const { message, room, username } = data;
    
    // Mesajı aynı odadaki herkese gönder (gönderen hariç)
    socket.to(room).emit('new_message', {
      username: username,
      message: message,
      timestamp: new Date().toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    });
    
    console.log(`💬 ${username}: ${message}`);
  });

  // Odadan ayrılma
  socket.on('leave_room', () => {
    if (socket.currentRoom && socket.username) {
      // Kullanıcıyı odadan çıkar
      if (rooms[socket.currentRoom]) {
        rooms[socket.currentRoom].delete(socket.username);
        
        // Diğer kullanıcılara bildir
        socket.to(socket.currentRoom).emit('user_left', {
          username: socket.username,
          users: Array.from(rooms[socket.currentRoom])
        });
        
        socket.to(socket.currentRoom).emit('system_message', 
          `${socket.username} odadan ayrıldı.`);
        
        // Oda boşsa sil
        if (rooms[socket.currentRoom].size === 0) {
          delete rooms[socket.currentRoom];
        }
      }
      
      socket.leave(socket.currentRoom);
      console.log(`👋 ${socket.username} ${socket.currentRoom} odasından ayrıldı`);
      
      socket.currentRoom = null;
      socket.username = null;
    }
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    console.log('🔴 Kullanıcı ayrıldı:', socket.id);
    
    if (socket.currentRoom && socket.username) {
      if (rooms[socket.currentRoom]) {
        rooms[socket.currentRoom].delete(socket.username);
        
        socket.to(socket.currentRoom).emit('user_left', {
          username: socket.username,
          users: Array.from(rooms[socket.currentRoom])
        });
        
        socket.to(socket.currentRoom).emit('system_message', 
          `${socket.username} bağlantısı koptu.`);
        
        if (rooms[socket.currentRoom].size === 0) {
          delete rooms[socket.currentRoom];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});