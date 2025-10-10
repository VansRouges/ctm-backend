import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../model/user.model.js';
import { createNotification } from '../utils/notificationHelper.js';
import logger from '../utils/logger.js';

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    logger.info('🔍 Google OAuth callback received', {
      profileId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName
    });

    // Check if user already exists with Google ID
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      logger.info('✅ Existing Google user found', {
        userId: user._id,
        email: user.email
      });
      return done(null, user);
    }

    // Check if user exists with same email
    const email = profile.emails?.[0]?.value;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
      
      if (user) {
        // Link Google account to existing user
        user.googleId = profile.id;
        user.isEmailVerified = true; // Google emails are verified
        await user.save();
        
        logger.info('🔗 Linked Google account to existing user', {
          userId: user._id,
          email: user.email
        });
        
        return done(null, user);
      }
    }

    // Create new user
    const userData = {
      googleId: profile.id,
      email: email?.toLowerCase(),
      firstName: profile.name?.givenName || '',
      lastName: profile.name?.familyName || '',
      username: email?.split('@')[0] || `user_${profile.id}`,
      profilePicture: profile.photos?.[0]?.value || '',
      isEmailVerified: true,
      authProvider: 'google',
      lastLogin: new Date(),
      isActive: true
    };

    user = new User(userData);
    await user.save();

    // Create notification for admin about new Google registration
    await createNotification({
      action: 'user_created',
      userId: user._id,
      metadata: {
        authProvider: 'google',
        email: user.email,
        referenceId: user._id.toString()
      }
    });

    logger.info('✅ New Google user created', {
      userId: user._id,
      email: user.email,
      authProvider: 'google'
    });

    return done(null, user);
  } catch (error) {
    logger.error('❌ Google OAuth error', {
      error: error.message,
      profileId: profile?.id
    });
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;