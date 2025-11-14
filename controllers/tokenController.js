const { getValuesFromToken } = require('../services/jwt');

exports.extractTokenValues = (req, res) => {
    const values = getValuesFromToken(req, res);
    if (!values) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.status(200).json({ success: true, values });
};