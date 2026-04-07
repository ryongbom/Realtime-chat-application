const express = require('express');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const User = require('./models/User');
const formatTime = require('./utils/formatTime');
const { authenticateSocket } = require('./middleware/auth');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const JWT_SECRET = 'your-super-secret-key-change-this'; // it is important for jwt

app.use(express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.post('/register', async (req, res) => {
    try {
        const { email, nickname, password } = req.body;

        if (!email || !nickname || !password) {
            console.log('Missing fields');
            return res.status(400).json({ error: 'All fields required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            email,
            password: hashedPassword,
            nickname
        });

        await user.save();
        console.log('User saved successfully');
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({ error: `${field} already exists` });
        }

        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!await user.comparePassword(req.body.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Issue JWT token
        const token = jwt.sign(
            { userId: user._id, nickname: user.nickname, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            nickname: user.nickname,
            email: user.email
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

const users = new Map();
const rooms = new Map();

function getRoomList() {
    return Array.from(rooms.keys());
}

function getUsersInRoom(roomName) {
    const roomSet = rooms.get(roomName);
    if (!roomSet) return [];

    const usersInRoom = [];

    roomSet.forEach(socketId => {
        const user = users.get(socketId);

        if (user) {
            usersInRoom.push({
                nickname: user.nickname,
                userId: user.userId
            });
        }
    });
    return usersInRoom;
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
        return message;
        console.log('messageId:', message._id);
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

io.use(authenticateSocket);

io.on('connection', (socket) => {
    console.log('connected to Server', socket.id);
    let currentUser = {
        nickname: socket.user.nickname,
        currentRoom: null,
        userId: socket.user.userId
    };

    users.set(socket.id, currentUser);

    socket.emit('system message', {
        content: `✨ Welcome ${socket.user.nickname} ✨`,
        timeStamp: formatTime()
    });

    socket.emit('room list', getRoomList());

    socket.on('chat message', async (data) => {
        if (currentUser && currentUser.currentRoom) {
            const savedMessage = await saveMessage(currentUser.currentRoom, {
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
                timeStamp: formatTime(),
                messageId: savedMessage._id
            });
            console.log(savedMessage._id);
        }
    });

    socket.on('delete message', async (data) => {
        await Message.findByIdAndUpdate(data.messageId, { isDeleted: true });

        io.to(data.room).emit('message deleted', { messageId: data.messageId });
        /* io.emit('message deleted', { messageId: data.messageId }); */
    })

    socket.on('create room', async (roomName) => {
        try {
            if (!rooms.has(roomName)) {
                const roomSet = new Set();
                roomSet.add(socket.id);
                rooms.set(roomName, roomSet);

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

                socket.emit('room users', [{
                    nickname: currentUser.nickname,
                    userId: currentUser.userId
                }]);

                socket.emit('room joined', roomName);

                const history = await Message.find({
                    room: roomName,
                    isDeleted: { $ne: true }
                }).sort({ timeStamp: 1 });
                if (history) {
                    socket.emit('room history', history);
                }

            } else {
                socket.emit('system message', {
                    content: `Here is already name of room '${roomName}'`,
                    timeStamp: formatTime()
                });
            }
        } catch (err) {
            console.error('Error', err);
        }

    });

    socket.on('join room', async (roomName) => {
        if (rooms.has(roomName) && currentUser) {
            if (currentUser.currentRoom) {
                socket.leave(currentUser.currentRoom);
            }
            socket.join(roomName);
            currentUser.currentRoom = roomName;

            const roomSet = rooms.get(roomName);
            roomSet.add(socket.id);
            rooms.set(roomName, roomSet);

            socket.emit('room joined', roomName);

            const usersInRoom = getUsersInRoom(roomName);
            socket.emit('room users', usersInRoom);

            socket.to(roomName).emit('user joined', {
                nickname: currentUser.nickname,
                userId: currentUser.userId
            });

            socket.to(roomName).emit('system message', {
                content: `👋 ${currentUser.nickname} joined to this room`,
                timeStamp: formatTime()
            });

            const history = await Message.find({
                room: roomName,
                isDeleted: { $ne: true }
            }).sort({ timeStamp: 1 });
            socket.emit('room history', history);
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('user typing', { nickname: socket.user.nickname });
    });

    socket.on('stop typing', (data) => {
        socket.to(data.room).emit('user stop typing', { nickname: socket.user.nickname });
    });

    socket.on('read receipt', async (data) => {
        const { messageId, room } = data;
        const userId = currentUser.userId;

        try {
            await Message.findByIdAndUpdate(messageId, {
                $addToSet: { readBy: userId }
            });

            const message = await Message.findById(messageId);
            const readCount = message.readBy.length;

            io.to(room).emit('read update', {
                messageId: messageId,
                readCount: readCount
            });
        } catch (err) {
            console.log('read receipt error:', err);
        }
    })

    socket.on('disconnect', () => {
        if (currentUser) {
            if (currentUser.currentRoom) {
                const roomSet = rooms.get(currentUser.currentRoom);
                roomSet.delete(socket.id);
                rooms.set(currentUser.currentRoom, roomSet);
            }
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