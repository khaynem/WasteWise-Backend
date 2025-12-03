const mongoose = require('mongoose');

const unlockedChallengeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
    unlockedAt: { type: Date, default: Date.now }
});

unlockedChallengeSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

const UnlockedChallenge = mongoose.model('UnlockedChallenge', unlockedChallengeSchema);
module.exports = UnlockedChallenge;