// scripts/migrate-account-balance.js
// One-time migration to initialize accountBalance for existing users

// Load environment variables
import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

// Use your existing DB connection
import connectToDatabase from '../database/mongodb.js';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';

async function migrateAccountBalance() {
  try {
    // Use your app's database connection function
    logger.info('🔌 Connecting to MongoDB...');
    await connectToDatabase();
    logger.info('✅ Connected to MongoDB for migration');

    // Find all users without accountBalance or with null/undefined accountBalance
    const usersToMigrate = await User.find({
      $or: [
        { accountBalance: { $exists: false } },
        { accountBalance: null }
      ]
    });

    logger.info(`📊 Found ${usersToMigrate.length} users to migrate`);

    if (usersToMigrate.length === 0) {
      logger.info('🎉 No users need migration. All users already have accountBalance!');
      process.exit(0);
    }

    let migratedCount = 0;
    let errors = 0;

    for (const user of usersToMigrate) {
      try {
        // Set accountBalance = totalInvestment
        const totalInvestment = user.totalInvestment || 0;
        user.accountBalance = totalInvestment;
        await user.save();
        migratedCount++;

        logger.info(`✅ Migrated user ${user.email}: accountBalance set to ${totalInvestment}`, {
          userId: user._id,
          email: user.email,
          totalInvestment,
          accountBalance: user.accountBalance
        });

        if (migratedCount % 10 === 0) {
          logger.info(`📈 Progress: ${migratedCount}/${usersToMigrate.length} users migrated...`);
        }
      } catch (error) {
        logger.error(`❌ Error migrating user ${user._id}:`, {
          error: error.message,
          userId: user._id,
          email: user.email
        });
        errors++;
      }
    }

    logger.info('🎉 Migration complete!');
    logger.info(`   ✅ Successfully migrated: ${migratedCount} users`);
    logger.info(`   ❌ Errors: ${errors} users`);
    logger.info(`   📊 Total processed: ${usersToMigrate.length} users`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

migrateAccountBalance();