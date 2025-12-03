const mongoose = require('mongoose');

const userTierUnlockSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tier: { type: String, enum: ['Intermediate', 'Advanced'], required: true },
    unlockedAt: { type: Date, default: Date.now }
});

userTierUnlockSchema.index({ userId: 1, tier: 1 }, { unique: true });

const UserTierUnlock = mongoose.model('UserTierUnlock', userTierUnlockSchema);
module.exports = UserTierUnlock;
