const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { authenticateToken } = require('../services/jwt');
const listingController = require('../controllers/listingController');

router.post('/', authenticateToken(), upload.array('images', 5), listingController.createListing);
router.get('/', authenticateToken(), listingController.getAllListings);

router.get('/metrics', authenticateToken(), listingController.getListingMetricsBulk);
router.get('/:id/metrics', authenticateToken(), listingController.getListingMetrics);
router.post('/:id/like', authenticateToken(), listingController.toggleLikeListing);

router.get('/:id', authenticateToken(), listingController.getListingById);
router.patch('/:id', authenticateToken(), upload.array('images', 5), listingController.updateListing);
router.delete('/:id', authenticateToken(), listingController.deleteListing);
router.post('/comment/:listingId', authenticateToken(), listingController.addCommentToListing);
router.delete('/comment/:commentId', authenticateToken(), listingController.deleteCommentOnListing);
router.get('/comment/:listingId', authenticateToken(), listingController.getAllCommentsOnListing);

module.exports = router;