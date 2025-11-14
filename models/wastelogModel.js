const mongoose = require('mongoose');

const wasteLogSchema = new mongoose.Schema({
    recorder: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    wasteType: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    date: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

const WasteLog = mongoose.model('WasteLog', wasteLogSchema);

module.exports = WasteLog;
