const listingModel = require('../models/listingModel');
const ListingComment = require('../models/listingCommentModel');
const ListingMetric = require('../models/listingMetricModel');
const { getValuesFromToken } = require('../services/jwt');
const cloudinaryController = require('./cloudinarycontroller');

exports.createListing = async (req, res) => {
  const userData = getValuesFromToken(req);
  if (!userData) return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  try {
    const { title, price, category, contactNumber, location, description } = req.body;
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const mockReq = { file };
            const mockRes = {
              status: (code) => ({
                json: (data) => code === 200 ? resolve(data) : reject(data)
              })
            };
          cloudinaryController.upToCloudinary(mockReq, mockRes);
        });
        imageUrls.push(uploadResult.imageUrl);
      }
    }

    const newListing = new listingModel({
      user: userData.id,                 // FIX: store owner in 'user'
      sellerName: userData.username || userData.name || 'User',
      title,
      price,
      category,
      contactNumber,
      location,
      description,
      imageLinks: imageUrls
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.getAllListings = async (req, res) => {
    try {
        const listings = await listingModel.find().sort({ createdAt: -1 });
        res.status(200).json(listings);
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

exports.getListingById = async (req, res) => {
    try {
        const listing = await listingModel.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        res.status(200).json(listing);
    } catch (error) {
        console.error('Error fetching listing by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const tokenData = getValuesFromToken(req) || {};
    const userId = tokenData.id || tokenData._id;
    const listing = await listingModel.findById(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const ownerId = (listing.user || listing.seller)?.toString();
    if (ownerId && ownerId !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to edit this listing' });
    }

    const { title, price, category, contactNumber, location, description } = req.body;
    if (title !== undefined) listing.title = title;
    if (price !== undefined) listing.price = price;
    if (category !== undefined) listing.category = category;
    if (contactNumber !== undefined) listing.contactNumber = contactNumber;
    if (location !== undefined) listing.location = location;
    if (description !== undefined) listing.description = description;

    if (Array.isArray(req.files) && req.files.length) {
      const uploads = [];
      for (const f of req.files) {
        const up = await cloudinaryController.uploadBuffer(f.buffer, f.originalname);
        if (up?.secure_url) uploads.push(up.secure_url);
      }
      if (uploads.length) listing.imageLinks = uploads;
    }

    await listing.save();
    res.json(listing);
  } catch (e) {
    res.status(500).json({ message: 'Error updating listing', error: e.message });
  }
};

// NEW: Get metrics for a single listing
exports.getListingMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const userData = getValuesFromToken(req);
    const userId = userData?.id ?? null;

    const metric = await ListingMetric.findOne({ listingId: id }).lean();
    const favorites = metric?.favorites || 0;
    const liked = userId && metric?.likedBy ? metric.likedBy.some(uid => String(uid) === String(userId)) : false;
    
    res.json({ favorites, liked });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch metrics', message: e.message });
  }
};

// NEW: Bulk metrics for multiple listings
exports.getListingMetricsBulk = async (req, res) => {
  try {
    const userData = getValuesFromToken(req);
    const userId = userData?.id ?? null;
    const raw = String(req.query.ids || '').trim();
    if (!raw) return res.json({});

    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const metrics = await ListingMetric.find({ listingId: { $in: ids } }).lean();

    const out = {};
    ids.forEach((id) => {
      const m = metrics.find(metric => String(metric.listingId) === id);
      const favorites = m?.favorites || 0;
      const liked = userId && m?.likedBy ? m.likedBy.some(uid => String(uid) === String(userId)) : false;
      out[id] = { favorites, liked };
    });

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch metrics', message: e.message });
  }
};

// NEW: Toggle like
exports.toggleLikeListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userData = getValuesFromToken(req);
    if (!userData) return res.status(401).json({ error: 'Invalid or expired token' });
    const userId = userData.id || userData._id;

    const exists = await listingModel.exists({ _id: id });
    if (!exists) return res.status(404).json({ error: 'Listing not found' });

    let metric = await ListingMetric.findOne({ listingId: id });
    if (!metric) {
      metric = await ListingMetric.create({ listingId: id, favorites: 0, likedBy: [] });
    }

    const userIdStr = String(userId);
    const alreadyLiked = metric.likedBy.some(uid => String(uid) === userIdStr);
    let liked;

    if (alreadyLiked) {
      // Unlike
      metric.likedBy = metric.likedBy.filter(uid => String(uid) !== userIdStr);
      metric.favorites = Math.max(0, metric.favorites - 1);
      liked = false;
    } else {
      // Like
      metric.likedBy.push(userId);
      metric.favorites += 1;
      liked = true;
    }

    metric.updatedAt = new Date();
    await metric.save();

    res.json({ favorites: metric.favorites, liked });
  } catch (e) {
    res.status(500).json({ error: 'Failed to toggle like', message: e.message });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const tokenData = getValuesFromToken(req) || {};
    const userId = tokenData.id || tokenData._id;
    const listing = await listingModel.findById(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const ownerId = (listing.user || listing.seller)?.toString();
    if (ownerId && ownerId !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to delete this listing' });
    }

    await listingModel.deleteOne({ _id: id });
    await ListingComment.deleteMany({ listingId: id }).catch(() => {});
    await ListingMetric.deleteMany({ listingId: id }).catch(() => {});
    res.json({ message: 'Listing deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Error deleting listing', error: e.message });
  }
};

exports.addCommentToListing = async (req, res) => {
  const userData = getValuesFromToken(req);
  const { listingId } = req.params;
  const { comment } = req.body;

  if (!userData) {
    return res.status(401).json({ error: 'Invalid or expired token', token: userData });
  }
  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' });
  }
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  try {
    const exists = await listingModel.exists({ _id: listingId });
    if (!exists) return res.status(404).json({ error: 'Listing not found' });

    const newComment = await ListingComment.create({
      listingId,
      author: userData.id,
      authorName: userData.username || userData.name || 'Anonymous',
      comment: comment.trim(),
    });

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error adding comment to listing:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.deleteCommentOnListing = async (req, res) => {
  try {
    const userData = getValuesFromToken(req);
    if (!userData) return res.status(401).json({ error: 'Invalid or expired token' });

    const { commentId } = req.params; // FIX: correct destructuring
    if (!commentId) return res.status(400).json({ error: 'commentId is required' });

    const cm = await ListingComment.findById(commentId);
    if (!cm) return res.status(404).json({ error: 'Comment not found' });

    // allow author or listing owner to delete
    const listing = await listingModel.findById(cm.listingId).select('user');
    const isOwner = listing?.user?.toString() === String(userData.id);
    const isAuthor = cm.author?.toString() === String(userData.id);
    if (!isOwner && !isAuthor) return res.status(403).json({ error: 'Not authorized' });

    await ListingComment.deleteOne({ _id: commentId });
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllCommentsOnListing = async (req, res) => {
  const { listingId } = req.params;
  try {
    const comments = await ListingComment.find({ listingId }).sort({ createdAt: 1 });
    res.status(200).json(comments);
  } catch (error) {
    console.error('Error fetching comments for listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};