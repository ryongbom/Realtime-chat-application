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

// Socket connection processing
io.on('connection', (socket) => {
    console.log('new user connected:', socket.id);

    socket.on('chat message', (msg) => {
        console.log(`Message from ${socket.id}: ${msg}`);

        socket.emit('chat message', `Echo: ${msg}`);
    });

    // Disconnection processing
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
    });
});

// Server is starting
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});