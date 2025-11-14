require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Ranking = require('../models/rankingModel');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const users = await User.find({});
  console.log(`Found ${users.length} users`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const exists = await Ranking.findOne({ userId: user._id });
    if (exists) {
      skipped++;
      continue;
    }

    const points = 0;
    const rank = typeof Ranking.getRankByPoints === 'function'
      ? Ranking.getRankByPoints(points)
      : 'Bronze';

    const r = new Ranking({ userId: user._id, points, rank });
    await r.save();
    created++;
    console.log(`Created ranking for user ${user._id} -> ${rank}`);
  }

  console.log(`Backfill complete. total=${users.length} created=${created} skipped=${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});