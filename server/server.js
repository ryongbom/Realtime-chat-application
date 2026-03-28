const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const Message = require('./models/Message');

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

async function saveMessage(room, data) {
    try {
        const message = new Message({
            type: data.type,
            content: data.content,
            userId: data.userId,
            nickname: data.nickname,
            room: room
        });
        await message.save();
        console.log('message successfully saved');
    } catch (err) {
        console.log('save Error', err);
    }
}

mongoose.connect('mongodb://localhost:27017/chatingApp')
    .then(() => {
        console.log('Successfully conneted to mongoDB!');
        server.listen(3000, () => {
            console.log('Server is running at http://localhost:3000');
        });
    })
    .catch(err => {
        console.log('Error to connect', err);
    });

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

    socket.on('chat message', async (data) => {
        if (currentUser && currentUser.currentRoom) {
            saveMessage(currentUser.currentRoom, {
                type: 'user',
                content: data.content,
                userId: data.userId,
                nickname: currentUser.nickname
            });

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

    socket.on('join room', async (roomName) => {
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

            const history = await Message.find({ room: roomName }).sort({ timeStamp: 1 });
            socket.emit('room history', history);
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