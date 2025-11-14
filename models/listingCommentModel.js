const mongoose = require('mongoose');

const listingCommentSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  authorName: { type: String, default: "Anonymous" },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ListingComment = mongoose.model('ListingComment', listingCommentSchema);

module.exports = ListingComment;
