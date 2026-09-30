import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'docuaudit_secret_2026';

const signToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed, name, authProvider: 'local' });
    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || '', authProvider: 'local' },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.password) {
      return res.status(400).json({
        error: 'This account was created with Google Sign-In. Please click "Continue with Google" to sign in.',
      });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || '', authProvider: user.authProvider || 'local' },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Google Authentication endpoint
router.post('/google', async (req, res) => {
  try {
    const { credential, email: directEmail, name: directName, googleId: directGoogleId, avatar: directAvatar } = req.body;

    let email = directEmail;
    let name = directName;
    let googleId = directGoogleId;
    let avatar = directAvatar || '';

    // If Google ID token is supplied from Google Identity Services
    if (credential) {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          email = payload.email;
          name = payload.name || payload.given_name || email?.split('@')[0];
          googleId = payload.sub;
          avatar = payload.picture || avatar;
        } else {
          // Fallback decode if token format is JWT
          const parts = credential.split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (decoded && decoded.email) {
              email = decoded.email;
              name = decoded.name || decoded.email.split('@')[0];
              googleId = decoded.sub;
              avatar = decoded.picture || avatar;
            }
          }
        }
      } catch (err) {
        console.error('Google token verification error:', err);
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Unable to verify email from Google authentication.' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        googleId: googleId || '',
        avatar: avatar || '',
        authProvider: 'google',
      });
    } else {
      let modified = false;
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        modified = true;
      }
      if (user.authProvider !== 'google' && !user.password) {
        user.authProvider = 'google';
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'google',
      },
    });
  } catch (err) {
    console.error('Google auth route error:', err);
    return res.status(500).json({ error: err.message || 'Google authentication failed.' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'local',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
