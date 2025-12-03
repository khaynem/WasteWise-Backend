const scheduleModel = require('../models/scheduleModel');
const reportModel = require('../models/reportsModel');
const { getValuesFromToken } = require('../services/jwt');
const cloudinaryController = require('./cloudinarycontroller');
const WasteLog = require('../models/wastelogModel');
const Ranking = require('../models/rankingModel');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const { analyzeImage } = require('../services/bytez');

// Simple points mapping by waste type (multiplier per unit)
const WASTE_POINTS = {
  plastic: 2,
  paper: 1,
  metal: 3,
  glass: 2,
  organic: 0.5,
  electronics: 5,
  hazardous: 10,
  default: 1
};

async function awardPointsToUser(userId, pointsToAdd) {
  if (!userId || !Number.isFinite(pointsToAdd) || pointsToAdd <= 0) return null;
  let ranking = await Ranking.findOne({ userId });
  if (!ranking) {
    // create new ranking doc
    const initialPoints = Math.max(0, Math.round(pointsToAdd));
    let rankName = (typeof Ranking.getRankByPoints === 'function') ? Ranking.getRankByPoints(initialPoints) : null;
    rankName = rankName || 'Bronze';
    ranking = new Ranking({ userId, points: initialPoints, rank: rankName });
    await ranking.save();
    return ranking;
  }

  ranking.points = (ranking.points || 0) + Math.max(0, Math.round(pointsToAdd));
  // compute new rank, fallback to existing if helper returns null
  const newRank = (typeof Ranking.getRankByPoints === 'function') ? Ranking.getRankByPoints(ranking.points) : null;
  if (newRank) ranking.rank = newRank;
  await ranking.save();
  return ranking;
}
 
exports.getAllSchedules = async (req, res) => { 
    try {
        const schedules = await scheduleModel.find();
        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching schedules', error });
    }
}

exports.analyzeReportImage = async (req, res) => {
  const userData = getValuesFromToken(req);

  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    // Upload to Cloudinary first
    const uploadResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            if (code === 200) resolve(data);
            else reject(data);
          }
        })
      };
      cloudinaryController.upToCloudinary(req, mockRes);
    });

    // Analyze the uploaded image
    const { error, output } = await analyzeImage(uploadResult.imageUrl);

    if (error) {
      return res.status(500).json({ 
        message: 'Error analyzing image', 
        error,
        imageUrl: uploadResult.imageUrl 
      });
    }

    res.status(200).json({ 
      imageUrl: uploadResult.imageUrl,
      description: output,
      message: 'Image analyzed successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing image', error });
  }
};

exports.setReport = async (req, res) => { 
    const userData = getValuesFromToken(req);

    if (!userData) {
        return res.status(401).json({ error: 'Invalid or expired token or null', token: userData });
    }

    const { title, description, location } = req.body;
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided.' });
        }

        // Parse locCoords from body (supports both 'locCoords' GeoJSON and legacy 'locCoord' {lat,lng})
        let locCoords;
        try {
            let raw = req.body.locCoords ?? req.body.locCoord ?? null;

            if (raw) {
                if (typeof raw === 'string') {
                    raw = JSON.parse(raw);
                }

                // Accept GeoJSON { type:'Point', coordinates:[lat, lng] }
                if (
                    raw?.type === 'Point' &&
                    Array.isArray(raw.coordinates) &&
                    raw.coordinates.length === 2
                ) {
                    const lat = Number(raw.coordinates[0]);
                    const lng = Number(raw.coordinates[1]);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                        locCoords = { type: 'Point', coordinates: [lat, lng] };
                    }
                }
                // Accept legacy { lat, lng }
                else if (
                    typeof raw?.lat !== 'undefined' &&
                    typeof raw?.lng !== 'undefined'
                ) {
                    const lat = Number(raw.lat);
                    const lng = Number(raw.lng);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                        locCoords = { type: 'Point', coordinates: [lat, lng] };
                    }
                }
            }
        } catch (_) {
            // Ignore parsing errors, locCoords will remain undefined
        }

        // Use upToCloudinary function to upload image
        const uploadResult = await new Promise((resolve, reject) => {
            const mockRes = {
                status: (code) => ({
                    json: (data) => {
                        if (code === 200) resolve(data);
                        else reject(data);
                    }
                })
            };
            cloudinaryController.upToCloudinary(req, mockRes);
        });

        // Save report to DB
        const report = new reportModel({
            title,
            description,
            reporter: userData.id,
            reporterName: userData.username,
            location: location ?? null,
            date: new Date(),
            image: [uploadResult.imageUrl],
            ...(locCoords ? { locCoords } : {}) // only set if provided/valid
        });
        await report.save();

        // Award points for reporting to encourage participation
        // Base points for a report
        const REPORT_BASE_POINTS = 8;
        // Extra for including an image or precise coords
        const REPORT_IMAGE_BONUS = req.file ? 2 : 0;
        const REPORT_LOC_BONUS = locCoords ? 2 : 0;
        const totalReportPoints = REPORT_BASE_POINTS + REPORT_IMAGE_BONUS + REPORT_LOC_BONUS;
        // Update ranking (fire-and-forget but await so client gets updated info)
        const updatedRanking = await awardPointsToUser(userData.id, totalReportPoints);

        res.status(201).json({ message: 'Report created successfully!', report, ranking: updatedRanking });
    } catch (error) {
        res.status(500).json({ message: 'Error creating report', error });
    }
}

exports.getAllReports = async (req, res) => { 
    const userData = getValuesFromToken(req);

    if (!userData) {
        return res.status(401).json({ error: 'Invalid or expired token', token: userData });
    }

    try {
        const reports = await reportModel.find({ reporter: userData.id });
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reports', error });
    }
}

exports.editReport = async (req, res) => { 
  const userData = getValuesFromToken(req);

  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }

  const { title, description, location } = req.body;
  // Accept either :reportId or :id from the route
  const reportId = req.params.reportId || req.params.id;

  if (!reportId) {
    return res.status(400).json({ error: 'Report ID is required' });
  }

  try {
    const report = await reportModel.findOne({ _id: reportId, reporter: userData.id });
    if (!report) {
      return res.status(404).json({ error: 'Report not found or you do not have permission to edit it' });
    }

    // Parse locCoords from body (same as setReport) - expects [lat, lng]
    let locCoords;
    try {
      let raw = req.body.locCoords ?? req.body.locCoord ?? null;
      if (raw) {
        if (typeof raw === 'string') raw = JSON.parse(raw);

        if (raw?.type === 'Point' && Array.isArray(raw.coordinates) && raw.coordinates.length === 2) {
          const lat = Number(raw.coordinates[0]);
          const lng = Number(raw.coordinates[1]);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            locCoords = { type: 'Point', coordinates: [lat, lng] };
          }
        } else if (typeof raw?.lat !== 'undefined' && typeof raw?.lng !== 'undefined') {
          const lat = Number(raw.lat);
          const lng = Number(raw.lng);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            locCoords = { type: 'Point', coordinates: [lat, lng] };
          }
        }
      }
    } catch (_) {}

    // If a new image is provided, upload to Cloudinary and store only the view URL
    let newImageUrl;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (code === 200) resolve(data);
              else reject(data);
            }
          })
        };
        cloudinaryController.upToCloudinary(req, mockRes);
      });
      newImageUrl = uploadResult?.imageUrl;
    }

    report.title = title ?? report.title;
    report.description = description ?? report.description;
    report.location = location ?? report.location;
    report.date = new Date();
    if (req.file) report.image = [newImageUrl];
    if (req.body.locCoords) report.locCoords = JSON.parse(req.body.locCoords);

    await report.save();

    res.status(200).json({ message: 'Report updated successfully!', report });
  } catch (error) {
    res.status(500).json({ message: 'Error updating report', error });
  }
};

exports.addWasteLog = async (req, res) => { 
    const userData = getValuesFromToken(req);

    if (!userData) {
        return res.status(401).json({ error: 'Invalid or expired token', token: userData });
    }

    const { wasteType, quantity, unit, date } = req.body;

    if (!wasteType || !quantity || !unit || !date) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const wasteLog = new WasteLog({
            recorder: userData.id,
            wasteType,
            quantity,
            unit,
            date
        });
        await wasteLog.save();

        let qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) qty = 1;
        const typeKey = String(wasteType || '').toLowerCase();
        let multiplier = WASTE_POINTS.default;
        for (const key of Object.keys(WASTE_POINTS)) {
          if (key === 'default') continue;
          if (typeKey.includes(key)) {
            multiplier = WASTE_POINTS[key];
            break;
          }
        }
        const pointsToAdd = Math.max(1, Math.round(multiplier * qty));
        const updatedRanking = await awardPointsToUser(userData.id, pointsToAdd);

        res.status(201).json({ message: 'Waste log added successfully!', wasteLog, ranking: updatedRanking });
    } catch (error) {
        res.status(500).json({ message: 'Error adding waste log', error });
    }
};

exports.getWasteLogs = async (req, res) => { 
    const userData = getValuesFromToken(req);

    if (!userData) {
        return res.status(401).json({ error: 'Invalid or expired token', token: userData });
    }

    try {
        const wasteLogs = await WasteLog.find({ recorder: userData.id });
        res.status(200).json({ wasteLogs });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching waste logs', error });
    }
};

exports.deleteWasteLog = async (req, res) => {
  const userData = getValuesFromToken(req);
  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Waste log ID is required' });
  }

  try {
    const deleted = await WasteLog.findOneAndDelete({ _id: id, recorder: userData.id });
    if (!deleted) {
      return res.status(404).json({ error: 'Waste log not found' });
    }
    return res.status(200).json({ message: 'Waste log deleted successfully!', wasteLog: deleted });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting waste log', error });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const topRankings = await Ranking.find().sort({ points: -1 }).limit(10).lean();

    const userData = getValuesFromToken(req);
    const requesterId = userData?.id ?? null;

    const userIdStrings = new Set(topRankings.map(r => r.userId?.toString()).filter(Boolean));
    if (requesterId) userIdStrings.add(requesterId);
    const userIds = Array.from(userIdStrings);

    const users = userIds.length ? await User.find({ _id: { $in: userIds } }, 'username').lean() : [];
    const usersById = {};
    users.forEach(u => { usersById[u._id.toString()] = u; });

    const leaderboard = topRankings.map((r, idx) => {
      const uid = r.userId ? r.userId.toString() : null;
      return {
        placement: idx + 1,
        points: r.points,
        rank: r.rank,
        user: uid ? { _id: uid, username: usersById[uid]?.username || null } : null
      };
    });

    let userPlacement = null;
    if (requesterId) {
      const userRanking = await Ranking.findOne({ userId: requesterId }).lean();
      if (userRanking) {
        const higherCount = await Ranking.countDocuments({ points: { $gt: userRanking.points } });
        const position = higherCount + 1;
        const userDoc = usersById[requesterId] ?? (await User.findById(requesterId, 'username').lean());
        userPlacement = {
          placement: position,
          points: userRanking.points,
          rank: userRanking.rank,
          user: { _id: requesterId, username: userDoc?.username || null }
        };
      }
    }

    res.status(200).json({ leaderboard, userPlacement });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard', error });
  }
}

exports.viewCompleteProfile = async (req, res) => {
  const userData = getValuesFromToken(req);

  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }
  try {
    const user = await User.findById(userData.id).select('-password -emailToken -__v -verified');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user profile', error });
  }
}

exports.editProfile = async (req, res) => {
  const userData = getValuesFromToken(req);
  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }
  const { username } = req.body;
  try {
    const user = await User.findById(userData.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (username) user.username = username;
    await user.save();
    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
}

exports.deleteAccount = async (req, res) => {
  const userData = getValuesFromToken(req);
  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }
  try {
    const user = await User.findByIdAndDelete(userData.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting account', error });
  }
}

exports.changePassword = async (req, res) => {
  const userData = getValuesFromToken(req);
  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    const user = await User.findById(userData.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPass = await bcrypt.hash(newPassword, 15);

    user.password = hashedPass;
    await user.save();
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Error changing password', error });
  }
}