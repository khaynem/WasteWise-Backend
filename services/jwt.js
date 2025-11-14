const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

function authenticateToken(requiredRole) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers['authorization'];
            let token = (req.cookies && req.cookies.authToken) || (authHeader && authHeader.split(' ')[1]);

            // if (!token && req.cookies && req.cookies.authToken) {
            //     token = req.cookies.authToken;
            // }

            if (!token) {
                return res.status(401).json({ message: 'No token provided', code: 401 });
            }

            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return res.status(403).json({ message: 'Invalid or expired token', code: 403 });
                }

                const dbUser = await userModel.findById(decoded.id).lean();
                if (!dbUser) {
                    return res.status(401).json({ message: 'User not found', code: 401 });
                }

                if (dbUser.status !== 'active') {
                    return res.status(403).json({ message: `User status is ${dbUser.status}. Access denied.` });
                }

                if (!dbUser.verified) {
                    return res.status(403).json({ message: 'Email not verified. Please verify your email.' });
                }

                if (requiredRole && dbUser.role !== requiredRole) {
                    return res.status(403).json({ message: `Insufficient role. Required: ${requiredRole}, Received: ${dbUser.role}` });
                }

                req.user = {
                    id: dbUser._id.toString(),
                    username: dbUser.username,
                    email: dbUser.email,
                    role: dbUser.role,
                    status: dbUser.status,
                    verified: dbUser.verified
                };
                next();
            });
        } catch (e) {
            return res.status(500).json({ message: 'Auth processing error', error: e.message });
        }
    };
}

const getValuesFromToken = (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = (req.cookies && req.cookies.authToken) || (authHeader && authHeader.split(' ')[1]);
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email,
            role: decoded.role
        };
    } catch {
        return null;
    }
}

module.exports = { authenticateToken, getValuesFromToken };