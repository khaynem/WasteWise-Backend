const Challenge = require('../models/challengeModel');
const Submission = require('../models/submissionModel');
const { getValuesFromToken } = require('../services/jwt');
const Ranking = require('../models/rankingModel');
const UserTierUnlock = require('../models/userTierUnlockModel');

const TIER_UNLOCK_COSTS = {
  Intermediate: 100,
  Advanced: 250
};

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
    const unlockedTiers = await UserTierUnlock.find({ userId }).select('tier');
    const unlockedTierNames = unlockedTiers.map(u => u.tier);
    
    // Fetch all submissions for this user
    const submissions = await Submission.find({ userId }).select('challengeId status');
    const submissionMap = {};
    submissions.forEach(sub => {
      submissionMap[sub.challengeId.toString()] = sub.status;
    });
    
    const challengesWithStatus = challenges.map(challenge => {
      const isCompleted = challenge.completors.some(uid => uid.toString() === userId.toString());
      const isUnlocked = challenge.tier === 'Basic' || unlockedTierNames.includes(challenge.tier);
      const submissionStatus = submissionMap[challenge._id.toString()] || null;
      return { ...challenge.toObject(), completed: isCompleted, unlocked: isUnlocked, submissionStatus };
    });
    res.json(challengesWithStatus);
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
  const { title, description, instructions, points, tier } = req.body;
  if (!title || !description || !instructions || !points) {
    return res.status(400).json({ message: 'All fields required' });
  }
  try {
    const challenge = await Challenge.create({ 
      title, 
      description, 
      instructions, 
      points,
      tier: tier || 'Basic'
    });
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

    if (challenge.tier !== 'Basic') {
      const tierUnlocked = await UserTierUnlock.findOne({ userId, tier: challenge.tier });
      if (!tierUnlocked) {
        return res.status(403).json({ message: 'You must unlock this tier first' });
      }
    }

    const proof = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const submission = await Submission.create({
      challengeId,
      userId,
      username,
      proof,
      description: description.trim(),
      status: 'Pending'
    });

    await Challenge.updateOne(
      { _id: challengeId },
      { $addToSet: { completors: userId } }
    );

    res.status(201).json({
      message: 'Submission received and pending approval',
      submissionId: submission._id
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
      .select('username userId proof description submittedAt challengeId status rewardedAt');
    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
};

exports.unlockTier = async (req, res) => {
  try {
    const { tier } = req.params;
    const user = getValuesFromToken(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    
    const userId = user.id || user._id;
    
    if (tier === 'Basic') {
      return res.status(400).json({ message: 'Basic tier is already unlocked' });
    }

    if (!['Intermediate', 'Advanced'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier' });
    }

    const alreadyUnlocked = await UserTierUnlock.findOne({ userId, tier });
    if (alreadyUnlocked) {
      return res.status(400).json({ message: 'Tier already unlocked' });
    }

    const unlockCost = TIER_UNLOCK_COSTS[tier];
    const ranking = await Ranking.findOne({ userId });
    if (!ranking || ranking.points < unlockCost) {
      return res.status(400).json({ message: 'Insufficient points to unlock' });
    }

    ranking.points -= unlockCost;
    ranking.rank = Ranking.getRankByPoints(ranking.points);
    await ranking.save();

    await UserTierUnlock.create({ userId, tier });

    res.json({ message: 'Tier unlocked successfully', newPoints: ranking.points });
  } catch (error) {
    res.status(500).json({ message: 'Error unlocking tier', error: error.message });
  }
};

exports.rewardSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    if (submission.status === 'Approved') {
      return res.status(400).json({ message: 'Submission already approved' });
    }

    const challenge = await Challenge.findById(submission.challengeId);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

    const challengePoints = Number(challenge.points) || 0;
    const updatedRanking = await awardPointsToUser(submission.userId, challengePoints);

    submission.status = 'Approved';
    submission.rewardedAt = new Date();
    await submission.save();

    res.json({
      message: 'Points awarded successfully',
      pointsAwarded: challengePoints,
      ranking: updatedRanking
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rewarding submission', error: error.message });
  }
};