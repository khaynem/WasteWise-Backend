const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    instructions: { type: String, required: true },
    points: { type: Number, required: true },
    tier: { type: String, enum: ['Basic', 'Intermediate', 'Advanced'], default: 'Basic' },
    completors: {type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    createdAt: { type: Date, default: Date.now }
})

const Challenge = mongoose.model('Challenge', challengeSchema);
module.exports = Challenge;