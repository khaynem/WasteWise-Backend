const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/check', authController.checkAuth);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword); 
router.post('/reset-password/:token', authController.resetPassword); 
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/google', authController.googleAuth);

module.exports = router;