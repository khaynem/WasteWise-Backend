const mongoose = require('mongoose');
const challenge = require('./challengeModel');

const submissionSchema = new mongoose.Schema({
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    proof: { type: String, required: true },
    description: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now }
})

const Submission = mongoose.model('Submission', submissionSchema);
module.exports = Submission;