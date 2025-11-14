const Challenge = require('../models/challengeModel');
const Submission = require('../models/submissionModel');
const { getValuesFromToken } = require('../services/jwt');
const Ranking = require('../models/rankingModel');

// Import awardPointsToUser helper (or define it here)
async function awardPointsToUser(userId, pointsToAdd) {
  if (!userId || !Number.isFinite(pointsToAdd) || pointsToAdd <= 0) return null;
  let ranking = await Ranking.findOne({ userId });
  if (!ranking) {
    const initialPoints = Math.max(0, Math.round(pointsToAdd));
    const rankName = Ranking.getRankByPoints(initialPoints);
    ranking = new Ranking({ userId, points: initialPoints, rank: rankName });
    await ranking.save();
    return ranking;
  }

  ranking.points = (ranking.points || 0) + Math.max(0, Math.round(pointsToAdd));
  ranking.rank = Ranking.getRankByPoints(ranking.points);
  
  await ranking.save();
  return ranking;
}

exports.getAllChallenges = async (req, res) => {
  const user = getValuesFromToken(req);
  if(!user){
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const userId = user.id || user._id;
    const challenges = await Challenge.find().sort({ createdAt: -1 });
    // Mark challenges as completed based on user completors
    const challengesWithCompletion = challenges.map(challenge => {
      const isCompleted = challenge.completors.some(uid => uid.toString() === userId.toString());
      return { ...challenge.toObject(), completed: isCompleted };
    });
    res.json(challengesWithCompletion);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching challenges', error: error.message });
  }
};

exports.getChallengeById = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });
    res.json(challenge);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching challenge', error: error.message });
  }
};

exports.createChallenge = async (req, res) => {
  const { title, description, instructions, points } = req.body;
  if (!title || !description || !instructions || !points) {
    return res.status(400).json({ message: 'All fields required' });
  }
  try {
    const challenge = await Challenge.create({ title, description, instructions, points });
    res.status(201).json(challenge);
  } catch (error) {
    res.status(500).json({ message: 'Error creating challenge', error: error.message });
  }
};

exports.deleteChallenge = async (req, res) => {
  try {
    const deleted = await Challenge.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Challenge not found' });
    res.json({ message: 'Challenge deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting challenge', error: error.message });
  }
};

exports.submitEntry = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { description } = req.body;
    const file = req.file;

    if (!challengeId) return res.status(400).json({ message: 'Missing challengeId' });
    if (!description || !description.trim()) return res.status(400).json({ message: 'Description is required' });
    if (!file) return res.status(400).json({ message: 'Image is required' });

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

    const tokenData = getValuesFromToken(req) || {};
    const userId = tokenData.id || tokenData._id || req.user?.id || req.user?._id;
    const username = tokenData.username || tokenData.name || req.user?.username || 'User';

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Check if user already completed this challenge
    const alreadyCompleted = challenge.completors.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyCompleted) {
      return res.status(400).json({ message: 'You have already completed this challenge' });
    }

    const proof = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const submission = await Submission.create({
      challengeId,
      userId,
      username,
      proof,
      description: description.trim(),
    });

    // Mark user as completor
    await Challenge.updateOne(
      { _id: challengeId },
      { $addToSet: { completors: userId } }
    );

    // Award points for completing challenge
    const challengePoints = Number(challenge.points) || 0;
    const updatedRanking = await awardPointsToUser(userId, challengePoints);

    res.status(201).json({
      message: 'Submission received',
      submissionId: submission._id,
      pointsAwarded: challengePoints,
      ranking: updatedRanking
    });
  } catch (error) {
    res.status(500).json({ message: 'Error handling submission', error: error.message });
  }
};

exports.getSubmissionsForChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const subs = await Submission
      .find({ challengeId: id })
      .sort({ submittedAt: -1 })
      .select('username userId proof description submittedAt challengeId');
    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
};