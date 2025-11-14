const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {type: String, required: true, unique: true},
    role: {type: String, default: 'user', enum: ['user', 'admin']},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    status: {type: String, default: 'active', enum: ['active', 'suspended', 'banned']},
    verified: {type: Boolean, default: false},
    emailToken: {type: String},
    joinDate: {type: Date, default: Date.now},
    lastLogin: {type: Date, default: null},
}, { collection: 'users' });

userSchema.index({ emailToken: 1 }, { sparse: true });

const User = new mongoose.model('users', userSchema);

module.exports = User
