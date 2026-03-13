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

// 소켓련결처리
io.on('connection', (socket) => {
    console.log('new user connected:', socket.id);

    // 련결해제처리
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
    });
});

// 서버 시작
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});