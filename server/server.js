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

const users = new Map();
const rooms = new Map();

function getRoomList() {
    return Array.from(rooms.keys());
}

function formatTime(time = new Date()) {
    return time.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

io.on('connection', (socket) => {
    console.log('connected to Server', socket.id);
    let currentUser = null;

    socket.on('nickname', (data) => {
        currentUser = { nickname: data.nickname, currentRoom: null };
        users.set(socket.id, currentUser);

        console.log(`👤 ${data.nickname} joined`);

        socket.emit('system message', {
            content: `✨ Welcome ${data.nickname} ✨`,
            timeStamp: formatTime()
        });

        socket.emit('room list', getRoomList());
    });

    socket.on('chat message', (data) => {
        if (currentUser && currentUser.currentRoom) {
            io.to(currentUser.currentRoom).emit('chat message', {
                type: 'user',
                content: data.content,
                userId: data.userId,
                nickname: currentUser.nickname,
                currentRoom: currentUser.currentRoom,
                timeStamp: formatTime()
            });
        }
    });

    socket.on('create room', (roomName) => {
        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Set());

            if (currentUser) {
                if (currentUser.currentRoom) {
                    socket.leave(currentUser.currentRoom);
                }
                socket.join(roomName);
                currentUser.currentRoom = roomName;
            }

            io.emit('room list', getRoomList());

            socket.emit('system message', {
                content: `'${roomName}' room created`,
                timeStamp: formatTime()
            });

            socket.emit('room joined', roomName);
        } else {
            socket.emit('system message', {
                content: `Here is already name of room '${roomName}'`,
                timeStamp: formatTime()
            });
        }
    });

    socket.on('join room', (roomName) => {
        if (rooms.has(roomName) && currentUser) {
            if (currentUser.currentRoom) {
                socket.leave(currentUser.currentRoom);
            }
            socket.join(roomName);
            currentUser.currentRoom = roomName;

            socket.emit('room joined', roomName);

            socket.to(roomName).emit('system message', {
                content: `👋 ${currentUser.nickname} joined to this room`,
                timeStamp: formatTime()
            });
        }
    });

    socket.on('disconnect', () => {
        if (currentUser) {
            console.log(`${currentUser.nickname} disconnected`);

            if (currentUser.currentRoom) {
                socket.to(currentUser.currentRoom).emit('system message', {
                    content: `${currentUser.nickname} left from Server`,
                    timeStamp: formatTime()
                });
            }

            users.delete(socket.id);
        }
    });
});

server.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
});