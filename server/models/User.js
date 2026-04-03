const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    nickname: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
/*
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        console.log('Password not modified, skipping hash');
        return next();
    }

    console.log('Hashing password...');
    try {
        this.password = await bcrypt.hash(this.password, 10);
        console.log('Password hashed successfully');
        next();
    } catch (err) {
        console.log('Error hashing password:', err);
        next(err);
    }
});
*/

userSchema.methods.comparePassword = async function (candidate) {
    return await bcrypt.compare(candidate, this.password);
}

module.exports = mongoose.model('User', userSchema);