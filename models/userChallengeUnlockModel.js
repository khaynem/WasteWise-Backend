const mongoose = require('mongoose');

const userChallengeUnlockSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
    unlockedAt: { type: Date, default: Date.now }
});

userChallengeUnlockSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

const UserChallengeUnlock = mongoose.model('UserChallengeUnlock', userChallengeUnlockSchema);
module.exports = UserChallengeUnlock;
