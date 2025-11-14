const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mailer = require('../services/mailer'); 
const rank = require('../models/rankingModel');


const resetTokens = new Map();

exports.signup = async (req, res) => {
    const { username, password, confirmPass, email } = req.body;

    if (!username || !password || !confirmPass || !email) {
        return res.status(400).json({ message: 'All fields are required', code: 400 });
    }
    if (password !== confirmPass) {
        return res.status(400).json({ message: "Password doesn't match", code: 400 });
    }

    try {
        const existing = await userModel.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            return res.status(409).json({ message: 'Username or email already in use', code: 409 });
        }

        const hashedPass = await bcrypt.hash(password, 15);
        const emailToken = crypto.randomBytes(32).toString('hex');
        const now = new Date();

        const user = new userModel({
            username,
            email,
            password: hashedPass,
            verified: false,
            emailToken,
            joinDate: now,        // explicit (model already has default)
            lastLogin: null       // explicit initial state
        });
        await user.save();

        const backendBase = process.env.BACKEND_URL || 'http://localhost:3001';
        const verifyLink = `${backendBase.replace(/\/+$/,'')}/api/auth/verify-email/${emailToken}`;

        console.log('[SIGNUP] Created user:', user._id.toString(), 'Email token:', emailToken);

        await mailer.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'WasteWise Email Verification',
            text: `Hi ${username}, please verify your email: ${verifyLink}`,
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #F3FFF7; padding: 32px;">
                  <div style="max-width: 520px; margin: auto; background: #ffffff; border-radius: 18px; box-shadow: 0 6px 28px -4px rgba(4,120,87,0.25), 0 2px 10px -2px rgba(4,120,87,0.12); padding: 40px 42px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <img src="https://wastewise.ph/images/wwlogo.webp" alt="WasteWise Logo" style="width:72px;height:72px;border-radius:16px;box-shadow:0 4px 14px rgba(4,120,87,0.25);margin-bottom:12px;" />
                      <h1 style="color:#047857;font-size:1.9rem;letter-spacing:.5px;margin:0 0 4px;">WasteWise</h1>
                      <p style="color:#1f2937;font-size:.95rem;margin:0;font-weight:500;">Smart waste management for a greener future</p>
                    </div>

                    <h2 style="color:#047857;font-size:1.25rem;margin:0 0 18px;">Verify Your Email</h2>
                    <p style="color:#111827;font-size:1rem;line-height:1.55;margin:0 0 14px;">
                      Hello <strong style="color:#065f46;">${username}</strong>,
                    </p>
                    <p style="color:#374151;font-size:1rem;line-height:1.55;margin:0 0 18px;">
                      Thanks for signing up to <strong>WasteWise</strong>. Please confirm your email address to activate your account.
                    </p>

                    <div style="text-align:center;margin:30px 0 34px;">
                      <a href="${verifyLink}" style="background:#047857;color:#ffffff;text-decoration:none;padding:14px 38px;font-size:1rem;font-weight:600;border-radius:10px;display:inline-block;box-shadow:0 4px 18px -4px rgba(4,120,87,0.55),0 2px 8px -2px rgba(4,120,87,0.25);letter-spacing:.3px;">
                        Verify Email
                      </a>
                    </div>

                    <p style="color:#4b5563;font-size:.9rem;line-height:1.5;margin:0 0 16px;">
                      If the button doesn’t work, copy and paste this link into your browser:
                    </p>
                    <p style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 14px;border-radius:8px;font-size:.72rem;line-height:1.35;color:#065f46;word-break:break-all;margin:0 0 26px;font-family:Consolas,Menlo,monospace;">
                      ${verifyLink}
                    </p>

                    <div style="border-top:1px solid #e5e7eb;padding-top:18px;margin-top:8px;">
                      <p style="color:#6b7280;font-size:.78rem;line-height:1.4;margin:0 0 6px;">
                        Didn’t create this account? You can safely ignore this email.
                      </p>
                      <p style="color:#9ca3af;font-size:.7rem;letter-spacing:.5px;margin:0;">
                        &copy; ${new Date().getFullYear()} WasteWise. All rights reserved.
                      </p>
                    </div>
                  </div>
                </div>
            `
        });

        return res.status(200).json({
            message: 'Signup successful. Check your email to verify your account.',
            emailToken: process.env.NODE_ENV === 'production' ? undefined : emailToken,
            verifyLink: process.env.NODE_ENV === 'production' ? undefined : verifyLink
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    const { cred, password } = req.body;
    if (!cred || !password) {
        return res.status(400).json({ message: 'All fields are required', code: 400 });
    }

    try {
        const user = await userModel.findOne({ $or: [{ username: cred }, { email: cred }] });
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 404 });
        }

        if (!user.verified) {
            return res.status(403).json({ message: 'Email not verified. Please check your inbox.', code: 403 });
        }

        const status = String(user.status || "").toLowerCase();
        if (status && status !== "active") {
            return res.status(403).json({ message: `Account is ${user.status}. Contact support.`, code: 403 });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials', code: 400 });
        }

        // Update lastLogin timestamp
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user._id, username: user.username, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('authToken', token, {
            httpOnly: false,
            sameSite: 'Lax',
            secure: false,
            path: '/',
            maxAge: 24 * 60 * 60 * 1000
        });

        console.log('[LOGIN] Set auth cookie for user:', user._id.toString(), 'token len:', token.length);

        return res.status(200).json({
            message: 'Login successful',
            token,
            role: user.role,
            joinDate: user.joinDate,
            lastLogin: user.lastLogin,
            code: 200
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        // Store token and expiry in memory
        resetTokens.set(token, { userId: user._id, expires: Date.now() + 3600000 }); // 1 hour

        // Build reset link (adjust frontend URL as needed)
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;

        // Send email
        await mailer.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'WasteWise Password Reset',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #F3FFF7; padding: 32px;">
                  <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(4,120,87,0.10); padding: 32px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <img src='https://wastewise.ph/images/wwlogo.png' alt='WasteWise Logo' style="width: 64px; height: 64px; border-radius: 12px; margin-bottom: 8px;" />
                      <h1 style="color: #047857; font-size: 1.7rem; margin: 0;">WasteWise</h1>
                      <p style="color: #222; font-size: 1rem; margin: 0;">Smart waste management for a greener future</p>
                    </div>
                    <h2 style="color: #047857; font-size: 1.2rem; margin-bottom: 16px;">Password Reset Request</h2>
                    <p style="color: #222; font-size: 1rem; margin-bottom: 16px;">
                      Hello <b>${user.username || user.email}</b>,
                    </p>
                    <p style="color: #333; font-size: 1rem; margin-bottom: 16px;">
                      You requested to reset your password. Click the button below to set a new password:
                    </p>
                    <div style="text-align: center; margin-bottom: 24px;">
                      <a href="${resetLink}" style="display: inline-block; background: #047857; color: #fff; font-weight: bold; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 1rem; box-shadow: 0 2px 8px rgba(4,120,87,0.08);">
                        Reset Password
                      </a>
                    </div>
                    <p style="color: #666; font-size: 0.95rem; margin-bottom: 8px;">
                      This link will expire in <b>1 hour</b>.
                    </p>
                    <p style="color: #888; font-size: 0.95rem;">
                      If you did not request this, you can ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <div style="text-align: center; color: #9ca3af; font-size: 0.9rem;">
                      WasteWise Team
                    </div>
                  </div>
                </div>
            `
        });

        return res.status(200).json({ message: 'Reset link sent to your email.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password, confirmPass } = req.body;

    if (!password || !confirmPass) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    if (password !== confirmPass) {
        return res.status(400).json({ message: "Passwords don't match" });
    }

    const tokenData = resetTokens.get(token);
    if (!tokenData || tokenData.expires < Date.now()) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    try {
        const user = await userModel.findById(tokenData.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.password = await bcrypt.hash(password, 15);
        await user.save();

        resetTokens.delete(token);

        return res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.params;

    if (!token || token.length !== 64) {
        console.log('[VERIFY] Invalid token format:', token);
        return res.status(400).json({ message: 'Invalid token format.' });
    }

    try {
        const user = await userModel.findOne({ emailToken: token });
        if (!user) {
            console.log('[VERIFY] No user found for token:', token);
            return res.status(404).json({ message: 'Invalid or expired verification link.' });
        }

        if (user.verified) {
            console.log('[VERIFY] User already verified:', user._id.toString());
            if (process.env.FRONTEND_URL) {
                return res.redirect(`${process.env.FRONTEND_URL}/email-verified`);
            }
            return res.status(200).json({ message: 'Email already verified.' });
        }

        user.verified = true;
        user.emailToken = undefined;
        await user.save();

        await rank.getRankByPoints(0);

        console.log('[VERIFY] Email verified for user:', user._id.toString());

        if (process.env.FRONTEND_URL) {
            return res.redirect(`${process.env.FRONTEND_URL}/email-verified`);
        }
        return res.status(200).json({ message: 'Email verified successfully!' });
    } catch (error) {
        console.error('[VERIFY] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};