const express = require('express');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const User = require('./models/User');
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

io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        console.log('Socket connection rejected: No token');
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        console.log('Socket authenticated:', decoded.nickname);
        next();
    } catch (err) {
        console.log('Socket connection rejected: Invalid token');
        next(new Error('Invalid token'));
    }
});

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

    /*
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
    */

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

    socket.on('create room', async (roomName) => {
        try {
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

                const history = await Message.find({ room: roomName }).sort({ timeStamp: 1 });
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