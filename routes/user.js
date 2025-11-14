const express = require('express');
const router = express.Router();
const userController = require('../controllers/userControllers');
const multer = require('multer');
const upload = multer(); 
const { authenticateToken } = require('../services/jwt');
const challengeController = require('../controllers/challengeController');

router.get('/schedules', authenticateToken('user'), userController.getAllSchedules);
router.get('/reports', authenticateToken('user'), userController.getAllReports);

// Add this endpoint for report creation
router.post('/report', authenticateToken('user'), upload.single('image'), userController.setReport);

router.patch('/report/:id', authenticateToken('user'), upload.single('image'), userController.editReport);

router.post('/wastelog', authenticateToken('user'), userController.addWasteLog);
router.get('/wastelogs', authenticateToken('user'), userController.getWasteLogs);
router.delete('/wastelog/:id', authenticateToken('user'), userController.deleteWasteLog);

router.get('/leaderboard', authenticateToken('user'), userController.getLeaderboard);

router.get('/challenges', authenticateToken('user'), challengeController.getAllChallenges);
router.get('/challenges/:id', authenticateToken('user'), challengeController.getChallengeById);
router.post('/challenges/submit/:challengeId', authenticateToken('user'), upload.single('image'), challengeController.submitEntry);

//profile management
router.get('/profile', authenticateToken('user'), userController.viewCompleteProfile);
router.patch('/profile', authenticateToken('user'), userController.editProfile);
router.patch('/profile/password', authenticateToken('user'), userController.changePassword);
router.delete('/profile', authenticateToken('user'), userController.deleteAccount);

module.exports = router;