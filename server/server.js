const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

let userCount = 0;

// Socket connection processing
io.on('connection', (socket) => {
    userCount++;
    console.log(`new user connected:, ${socket.id} (current number of users: ${userCount})`);

    socket.emit('chat message', {
        type: 'system',
        content: `✨ 서버에 접속되었습니다. 현재 ${userCount}명이 접속 중입니다.`,
        timestamp: new Date().toLocaleTimeString()
    });

    socket.broadcast.emit('chat message', {
        type: 'system',
        content: `👋 새로운 사용자가 들어왔습니다. (현재 ${userCount}명)`,
        timestamp: new Date().toLocaleTimeString()
    })

    socket.on('chat message', (msg) => {
        console.log(`Message from ${socket.id}: ${msg}`);

        io.emit('chat message', {
            type: 'user',
            userId: socket.id,
            content: msg,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    // Disconnection processing
    socket.on('disconnect', () => {
        userCount--;
        console.log(`user disconnected: ${socket.id} (current number of users: ${userCount})`);

        io.emit('chat message', {
            type: 'system',
            content: `👋 사용자가 나갔습니다. (현재 ${userCount}명)`,
            timestamp: new Date().toLocaleTimeString()
        });
    });
});

// Server is starting
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});