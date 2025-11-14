const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    barangay: { type: String, required: true },
    type: [
        {
            typeName: { type: String, required: true },
            day: { type: String, required: true }
        }
    ]
}, { collection: 'schedules' });

const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;