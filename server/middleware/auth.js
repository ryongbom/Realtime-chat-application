const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-super-secret-key-change-this';

const authenticateSocket = (socket, next) => {
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
};

module.exports = { authenticateSocket };