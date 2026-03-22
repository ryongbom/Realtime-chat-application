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

const users = new Map();

io.on('connection', (socket) => {
    console.log('connected to Server', socket.id);

    socket.on('nickname', (data) => {
        users.set(socket.id, { nickname: data.nickname });

        console.log(`👤 ${data.nickname} joined (${socket.id})`);

        io.emit('system message', {
            type: 'system',
            content: `${data.nickname} joined the chat`,
            timeStamp: data.timeStamp
        });

        socket.emit('system message', {
            type: 'system message',
            content: `Welcome ${data.nickname}`,
            timeStamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('chat message', (data) => {
        const user = users.get(socket.id);
        const nickname = user ? user.nickname : 'Unknown';

        io.emit('chat message', {
            type: 'user',
            content: data.content,
            userId: data.userId,
            nickname: nickname,
            timeStamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            console.log(`${user.nickname} disconnected (${socket.id})`);

            io.emit('system message', {
                type: 'system',
                content: `${user.nickname} left the chat`,
                timeStamp: new Date().toLocaleTimeString()
            });

            users.delete(socket.id);
        } else {
            console.log(`Unknown user disconnected (${socket.id})`);
        }
    });
});

server.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
});