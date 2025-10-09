#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, '../server.js');
const appPath = join(__dirname, '../app.js');

console.log('🔍 Pre-commit check: Verifying stock updater is enabled...');

try {
  const serverContent = readFileSync(serverPath, 'utf8');
  const appContent = readFileSync(appPath, 'utf8');

  let hasErrors = false;

  // Check server.js
  if (serverContent.includes('// import StockUpdater from')) {
    console.error('❌ server.js: StockUpdater import is commented out');
    hasErrors = true;
  }

  if (serverContent.includes('// stockUpdater.startScheduler') || 
      !serverContent.includes('stockUpdater.startScheduler(interval);')) {
    console.error('❌ server.js: Stock updater scheduler is disabled');
    hasErrors = true;
  }

  // Check app.js
  if (appContent.includes('// import StockUpdater from')) {
    console.error('❌ app.js: StockUpdater import is commented out');
    hasErrors = true;
  }

  if (appContent.includes('// const stockUpdater = new StockUpdater();') || 
      !appContent.includes('const stockUpdater = new StockUpdater();')) {
    console.error('❌ app.js: StockUpdater instantiation is disabled');
    hasErrors = true;
  }

  if (!appContent.includes("app.post('/api/admin/update-stocks'") ||
      appContent.includes('/*\napp.post')) {
    console.error('❌ app.js: Manual stock update endpoint is disabled');
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n💡 To fix these issues, run: npm run dev:enable-stock');
    console.error('💡 Or manually uncomment the StockUpdater imports and functionality\n');
    process.exit(1);
  }

  console.log('✅ Pre-commit check passed: Stock updater is enabled for production');

} catch (error) {
  console.error('❌ Error during pre-commit check:', error.message);
  process.exit(1);
}