const scheduleModel = require('../models/scheduleModel');
const reportModel = require('../models/reportsModel');
const userModel = require('../models/userModel');
const { getValuesFromToken } = require('../services/jwt');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { sendReportEmailDirect } = require('./notifController');

exports.getAllUsers = async (req, res) => { 
    try {
        const users = await userModel.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error });
    }
}

exports.getAllReports = async (req, res) => { 
    try {
        const reports = await reportModel.find();
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reports', error });
    }
}

exports.viewReport = async (req, res) => {
    const {id} = req.params;
    try {
        const report = await reportModel.findById(id);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching report', error });
    }
}

exports.downloadReport = async (req, res) => {
    try {
        const { status, from, to } = req.query;
        const query = {};
        if (status) query.reportStatus = status;
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(to);
        }

        const reports = await reportModel.find(query).sort({ date: -1 }).lean();
        if (!reports.length) {
            return res.status(404).json({ message: 'No reports found for the selected criteria.' });
        }

        const fileDate = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="waste-reports-${fileDate}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

        // Layout constants
        const TITLE_COLOR = '#047857';
        const LABEL_COLOR = '#222';
        const TEXT_COLOR = '#333';
        const LIGHT_COLOR = '#666';
        const DIVIDER_COLOR = '#E0E0E0';
        const PAGE_MARGIN = doc.page.margins.left;
        const CONTENT_WIDTH = doc.page.width - PAGE_MARGIN * 2;
        const SECTION_SPACING = 14;
        const LINE_SPACING = 6;
        const IMAGE_GAP = 10;
        const MAX_IMAGE_HEIGHT = 140; // Height per image row

        let pageNumber = 0;

        const addHeader = () => {
            doc.fillColor(TITLE_COLOR)
               .fontSize(18)
               .text('WasteWise Violation Reports', { align: 'center' });
            doc.moveDown(0.25);
            doc.fillColor(LIGHT_COLOR)
               .fontSize(9)
               .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown(0.6);
            horizontalRule();
            doc.moveDown(0.4);
        };

        const addFooter = () => {
            const bottomY = doc.page.height - 40;
            doc.fontSize(8)
               .fillColor('#888')
               .text(`Page ${pageNumber}`, PAGE_MARGIN, bottomY, {
                   width: CONTENT_WIDTH,
                   align: 'right'
               });
        };

        const newPage = (first = false) => {
            if (!first) {
                addFooter();
                doc.addPage();
            }
            pageNumber++;
            addHeader();
        };

        const horizontalRule = () => {
            doc.moveTo(PAGE_MARGIN, doc.y)
               .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
               .lineWidth(1)
               .strokeColor(DIVIDER_COLOR)
               .stroke();
        };

        const ensureSpace = (needed = 120) => {
            if (doc.y + needed > doc.page.height - 70) newPage();
        };

        // Text helpers
        const field = (label, value) => {
            doc.font('Helvetica-Bold')
               .fillColor(LABEL_COLOR)
               .fontSize(9)
               .text(label, { continued: true });
            doc.font('Helvetica')
               .fillColor(TEXT_COLOR)
               .fontSize(9)
               .text(value || 'N/A');
        };

        const twoColumnFields = (pairs) => {
            const colWidth = (CONTENT_WIDTH - 20) / 2;
            const startY = doc.y;
            let leftY = startY;
            let rightY = startY;
            pairs.forEach((p, i) => {
                const { label, value } = p;
                if (i % 2 === 0) {
                    doc.x = PAGE_MARGIN;
                    doc.y = leftY;
                    field(label, value);
                    leftY = doc.y;
                } else {
                    doc.x = PAGE_MARGIN + colWidth + 20;
                    doc.y = rightY;
                    field(label, value);
                    rightY = doc.y;
                }
            });
            doc.y = Math.max(leftY, rightY) + 4;
            doc.x = PAGE_MARGIN;
        };

        // Image loader (no axios)
        async function loadImageBuffer(imgPath) {
            if (!imgPath) return null;
            try {
                if (imgPath.startsWith('data:image/')) {
                    const base64 = imgPath.split(',')[1];
                    return Buffer.from(base64, 'base64');
                }
                if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
                    const resp = await fetch(imgPath);
                    if (!resp.ok) return null;
                    const arr = await resp.arrayBuffer();
                    return Buffer.from(arr);
                }
                let rel = imgPath.replace(/^\//, '');
                const abs = path.join(process.cwd(), rel);
                if (fs.existsSync(abs)) return fs.readFileSync(abs);
                const alt = path.join(__dirname, '..', rel);
                if (fs.existsSync(alt)) return fs.readFileSync(alt);
            } catch {
                return null;
            }
            return null;
        }

        const drawImagesGrid = async (images) => {
            const valid = images.filter(Boolean);
            if (!valid.length) return;
            doc.moveDown(0.4);
            doc.font('Helvetica-Bold').fontSize(10).fillColor(LABEL_COLOR).text('Image:');
            doc.moveDown(0.25);

            // Decide columns (max 3)
            const cols = valid.length >= 3 ? 3 : (valid.length === 2 ? 2 : 1);
            const cellWidth = Math.floor((CONTENT_WIDTH - IMAGE_GAP * (cols - 1)) / cols);

            let colIndex = 0;
            let rowStartY = doc.y;
            for (let i = 0; i < valid.length; i++) {
                ensureSpace(MAX_IMAGE_HEIGHT + 40);
                const buf = await loadImageBuffer(valid[i]);
                if (!buf) {
                    doc.fontSize(8).fillColor('#B00020').text(`(Image missing: ${valid[i]})`);
                    continue;
                }
                const x = PAGE_MARGIN + (colIndex * (cellWidth + IMAGE_GAP));
                const y = rowStartY;
                try {
                    doc.image(buf, x, y, {
                        fit: [cellWidth, MAX_IMAGE_HEIGHT],
                        align: 'center',
                        valign: 'center'
                    });
                } catch {
                    doc.fontSize(8).fillColor('#B00020').text(`(Failed to render: ${valid[i]})`, x, y);
                }
                colIndex++;
                if (colIndex === cols || i === valid.length - 1) {
                    rowStartY += MAX_IMAGE_HEIGHT + 10;
                    colIndex = 0;
                    doc.y = rowStartY;
                    doc.x = PAGE_MARGIN;
                }
            }
            doc.moveDown(0.3);
        };

        // Start PDF
        newPage(true);

        // Summary
        doc.fontSize(11).fillColor(LABEL_COLOR).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown(0.4);
        doc.font('Helvetica').fillColor(TEXT_COLOR).fontSize(9)
           .text(`Total Reports: ${reports.length}`)
           .text(`Date Range: ${new Date(reports[reports.length - 1].date).toLocaleDateString()} - ${new Date(reports[0].date).toLocaleDateString()}`);
        if (status) doc.text(`Filtered Status: ${status}`);
        if (from || to) doc.text(`Filter Dates: ${from || '---'} to ${to || '---'}`);
        doc.moveDown(0.6);
        horizontalRule();
        doc.moveDown(0.6);

        for (let i = 0; i < reports.length; i++) {
            const r = reports[i];
            ensureSpace(200);

            if (i > 0) {
                horizontalRule();
                doc.moveDown(0.6);
            }

            // Title
            field('Title: ', r.title || 'Untitled');
            doc.moveDown(0.35);

            // Date
            field(
                'Date and Time: ',
                r.date
                    ? new Date(r.date).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                      })
                    : 'N/A'
            );
            doc.moveDown(0.35);

            // Description
            doc.font('Helvetica-Bold').fillColor(LABEL_COLOR).fontSize(10).text('Description:');
            doc.font('Helvetica')
               .fillColor(TEXT_COLOR)
               .fontSize(9)
               .text(r.description || 'No description provided.', {
                   width: CONTENT_WIDTH,
                   align: 'left'
               });
            doc.moveDown(0.35);

            // Location
            field('Location: ', r.location || 'Not specified');
            doc.moveDown(0.2);

            // Status
            field('Status: ', (r.reportStatus || 'pending').toUpperCase());
            doc.moveDown(0.4);

            // Image
            if (Array.isArray(r.image) && r.image.length) {
                await drawImagesGrid(r.image.slice(0, 9));
                if (r.image.length > 9) {
                    doc.fontSize(8).fillColor(LIGHT_COLOR)
                       .text(`(+ ${r.image.length - 9} more not shown)`);
                }
            }
            doc.moveDown(0.4);
        }

        addFooter();
        doc.end();
    } catch (error) {
        console.error('[PDF_REPORT] Error:', error);
        return res.status(500).json({ message: 'Error generating report PDF', error: error.message });
    }
};

exports.manageReport = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await reportModel.findById(id);
        const user = await userModel.findById(report.reporter);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Mark as resolved
        report.reportStatus = "resolved";
        await report.save();
        
        // Send notification email
        await sendReportEmailDirect({
            to: user.email,
            reportId: report._id,
            report,
            subject: `Your WasteWise Report #${report._id} has been resolved`,
        });

        res.status(200).json({ message: "Report marked as resolved", report });
    } catch (error) {
        res.status(500).json({ message: "Failed to update report status", error: error.message });
    }
}

exports.suspendUser = async (req, res) => { 
    const {id} = req.params;
    try {
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.status = 'suspended';
        await user.save();
        res.status(200).json({ message: 'User suspended successfully', user });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({ message: 'Error suspending user', error: error.message });
    }
}

exports.banUser = async (req, res) => { 
    const {id} = req.params;
    try {
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.status = 'banned';
        await user.save();
        res.status(200).json({ message: 'User banned successfully', user });
    } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).json({ message: 'Error banning user', error: error.message });
    }
}

exports.deleteUser = async (req, res) => { 
    const {id} = req.params;
    try {
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await user.remove();
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
}

exports.activateUser = async (req, res) => { 
    const {id} = req.params;
    try {
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.status = 'active';
        await user.save();
        res.status(200).json({ message: 'User activated successfully', user });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({ message: 'Error activating user', error: error.message });
    }
}

exports.getAllSchedules = async (req, res) => { 
    try {
        const schedules = await scheduleModel.find();
        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching schedules', error });
    }
}

exports.editSchedule = async (req, res) => {
    const { barangay, typeName, newDay } = req.body;
    
    try {
        // Validate required fields
        if (!barangay || !typeName || !newDay) {
            return res.status(400).json({ 
                message: 'Missing required fields: barangay, typeName, and newDay are required' 
            });
        }

        // Find the schedule for the specific barangay
        const schedule = await scheduleModel.findOne({ barangay: barangay });
        
        if (!schedule) {
            return res.status(404).json({ 
                message: `Schedule not found for barangay: ${barangay}` 
            });
        }

        // Find the specific type within the schedule
        const typeToUpdate = schedule.type.find(type => type.typeName === typeName);
        
        if (!typeToUpdate) {
            return res.status(404).json({ 
                message: `Type '${typeName}' not found in barangay '${barangay}'` 
            });
        }

        // Store the old day for response
        const oldDay = typeToUpdate.day;
        
        // Update the day for the specific type
        typeToUpdate.day = newDay;
        
        // Save the updated schedule
        const updatedSchedule = await schedule.save();
        
        // Return response matching the frontend payload structure
        res.status(200).json({ 
            message: `Successfully updated ${typeName} schedule for ${barangay}`,
            data: {
                barangay: updatedSchedule.barangay,
                typeName: typeName,
                oldDay: oldDay,
                newDay: newDay,
                typeId: typeToUpdate._id
            },
            // Return the complete updated schedule in the same format as getAllSchedules
            updatedSchedule: {
                _id: updatedSchedule._id,
                barangay: updatedSchedule.barangay,
                type: updatedSchedule.type.map(t => ({
                    _id: t._id,
                    typeName: t.typeName,
                    day: t.day
                }))
            }
        });
        
    } catch (error) {
        console.error('Error editing schedule:', error);
        res.status(500).json({ 
            message: 'Error updating schedule', 
            error: error.message 
        });
    }
}