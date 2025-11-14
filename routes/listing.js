const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { authenticateToken } = require('../services/jwt');
const listingController = require('../controllers/listingController');

router.post('/', authenticateToken('user'), upload.array('images', 5), listingController.createListing);
router.get('/', authenticateToken('user'), listingController.getAllListings);

router.get('/metrics', authenticateToken('user'), listingController.getListingMetricsBulk);
router.get('/:id/metrics', authenticateToken('user'), listingController.getListingMetrics);
router.post('/:id/like', authenticateToken('user'), listingController.toggleLikeListing);

router.get('/:id', authenticateToken('user'), listingController.getListingById);
router.patch('/:id', authenticateToken('user'), upload.array('images', 5), listingController.updateListing);
router.delete('/:id', authenticateToken('user'), listingController.deleteListing);
router.post('/comment/:listingId', authenticateToken('user'), listingController.addCommentToListing);
router.delete('/comment/:commentId', authenticateToken('user'), listingController.deleteCommentOnListing);
router.get('/comment/:listingId', authenticateToken('user'), listingController.getAllCommentsOnListing);

module.exports = router;