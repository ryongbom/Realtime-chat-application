const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomName: {
        type: String,
        unique: true
    },
    createdUserNickname: {
        type: String
    },
    createdUserId: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Room', roomSchema);