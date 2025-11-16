const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../services/jwt');
const challengeController = require('../controllers/challengeController');

// User management routes
router.get('/users', authenticateToken(), adminController.getAllUsers);
router.patch('/users/:id/suspend', authenticateToken(), adminController.suspendUser);
router.patch('/users/:id/ban', authenticateToken(), adminController.banUser);
router.patch('/users/:id/activate', authenticateToken(), adminController.activateUser);

// Reports management routes
router.get('/reports', authenticateToken(), adminController.getAllReports);
router.patch('/reports/:id/manage', authenticateToken(), adminController.manageReport);
router.get('/reports/download/pdf', authenticateToken(), adminController.downloadReport);

// Schedule management routes
router.get('/schedules', authenticateToken(), adminController.getAllSchedules);
router.patch('/schedules/edit', authenticateToken(), adminController.editSchedule);

// Challenge management routes
router.get('/challenges', authenticateToken(), challengeController.getAllChallenges);
router.get('/challenges/:id', authenticateToken(), challengeController.getChallengeById);
router.get('/challenges/:id/submissions', authenticateToken(), challengeController.getSubmissionsForChallenge); // NEW
router.post('/challenges', authenticateToken(), challengeController.createChallenge);
router.delete('/challenges/:id', authenticateToken(), challengeController.deleteChallenge);

router.post('/user/role/update/:id', authenticateToken(), adminController.changeUserRole);

router.get('/wastelog', authenticateToken(), adminController.getWasteLogs);
router.post('/wastelog', authenticateToken(), adminController.addWasteLog);
router.delete('/wastelog/:id', authenticateToken(), adminController.deleteWasteLog);

module.exports = router;