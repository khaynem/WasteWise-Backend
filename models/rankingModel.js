const mongoose = require('mongoose');

const ranks = [
    { rank: 'Bronze', minPoints: 0, maxPoints: 100 },
    { rank: 'Silver', minPoints: 101, maxPoints: 200 },
    { rank: 'Gold', minPoints: 201, maxPoints: 300 },
    { rank: 'Platinum', minPoints: 301, maxPoints: 400 },
    { rank: 'Diamond', minPoints: 401, maxPoints: 500 },
    { rank: 'Master', minPoints: 501, maxPoints: 600 },
    { rank: 'Grandmaster', minPoints: 601, maxPoints: 700 },
    { rank: 'Challenger', minPoints: 701, maxPoints: 800 },
    { rank: 'Legend', minPoints: 801, maxPoints: 900 },
    { rank: 'Mythic', minPoints: 901, maxPoints: Infinity }, // Changed maxPoints to Infinity
]

const rankingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    points: { type: Number, default: 0 },
    rank: { type: String, enum: ranks.map(r => r.rank), default: 'Bronze' },
})

module.exports = mongoose.model('Ranking', rankingSchema);

module.exports.getRankByPoints = function(points) {
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (points >= ranks[i].minPoints) {
            return ranks[i].rank;
        }
    }
    return 'Bronze';
};

module.exports.ranks = ranks; 