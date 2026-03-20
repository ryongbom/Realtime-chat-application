const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { timeStamp } = require('console');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

io.on('connection', (socket) => {
    console.log('connected to Server', socket.id);

    socket.on('chat message', (data) => {
        console.log('received message: ', data.content);

        io.emit('chat message', {
            type: 'user',
            content: data.content,
            userId: data.userId,
            timeStamp: new Date().toLocaleDateString()
        });
    });

    socket.on('nickname', (data) => {
        io.emit('system nick', {
            type: data.type,
            nickname: data.nickname,
            timeStamp: data.timeStamp
        });
    })

    socket.on('disconnect', () => {
        console.log('disconnected from Server', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
});