const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    instructions: { type: String, required: true },
    points: { type: Number, required: true },
    completors: {type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },

})

const Challenge = mongoose.model('Challenge', challengeSchema);
module.exports = Challenge;