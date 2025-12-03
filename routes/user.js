const express = require('express');
const router = express.Router();
const userController = require('../controllers/userControllers');
const multer = require('multer');
const upload = multer(); 
const { authenticateToken } = require('../services/jwt');
const challengeController = require('../controllers/challengeController');

router.get('/schedules', authenticateToken(), userController.getAllSchedules);
router.get('/reports', authenticateToken(), userController.getAllReports);

// Add this endpoint for report creation
router.post('/report', authenticateToken(), upload.single('image'), userController.setReport);

router.patch('/report/:id', authenticateToken(), upload.single('image'), userController.editReport);

router.post('/wastelog', authenticateToken(), userController.addWasteLog);
router.get('/wastelogs', authenticateToken(), userController.getWasteLogs);
router.delete('/wastelog/:id', authenticateToken(), userController.deleteWasteLog);

router.get('/leaderboard', authenticateToken(), userController.getLeaderboard);

router.get('/challenges', authenticateToken(), challengeController.getAllChallenges);
router.get('/challenges/:id', authenticateToken(), challengeController.getChallengeById);
router.post('/challenges/submit/:challengeId', authenticateToken(), upload.single('image'), challengeController.submitEntry);
router.post('/challenges/tier/:tier/unlock', authenticateToken(), challengeController.unlockTier);

//profile management
router.get('/profile', authenticateToken(), userController.viewCompleteProfile);
router.patch('/profile', authenticateToken(), userController.editProfile);
router.patch('/profile/password', authenticateToken(), userController.changePassword);
router.delete('/profile', authenticateToken(), userController.deleteAccount);

// Image analysis endpoint (must be authenticated)
router.post('/analyze-image', authenticateToken(), upload.single('image'), userController.analyzeReportImage);

module.exports = router;