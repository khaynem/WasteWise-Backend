const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../services/jwt');
const challengeController = require('../controllers/challengeController');

// User management routes
router.get('/users', authenticateToken('admin'), adminController.getAllUsers);
router.patch('/users/:id/suspend', authenticateToken('admin'), adminController.suspendUser);
router.patch('/users/:id/ban', authenticateToken('admin'), adminController.banUser);
router.patch('/users/:id/activate', authenticateToken('admin'), adminController.activateUser);

// Reports management routes
router.get('/reports', authenticateToken('admin'), adminController.getAllReports);
router.patch('/reports/:id/manage', authenticateToken('admin'), adminController.manageReport);
router.get('/reports/download/pdf', authenticateToken('admin'), adminController.downloadReport);

// Schedule management routes
router.get('/schedules', authenticateToken('admin'), adminController.getAllSchedules);
router.patch('/schedules/edit', authenticateToken('admin'), adminController.editSchedule);

// Challenge management routes
router.get('/challenges', authenticateToken('admin'), challengeController.getAllChallenges);
router.get('/challenges/:id', authenticateToken('admin'), challengeController.getChallengeById);
router.get('/challenges/:id/submissions', authenticateToken('admin'), challengeController.getSubmissionsForChallenge); // NEW
router.post('/challenges', authenticateToken('admin'), challengeController.createChallenge);
router.delete('/challenges/:id', authenticateToken('admin'), challengeController.deleteChallenge);

module.exports = router;