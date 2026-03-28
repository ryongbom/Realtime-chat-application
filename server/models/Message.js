const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    type: String,
    content: String,
    userId: String,
    nickname: String,
    room: String,
    timeStamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Message', messageSchema);