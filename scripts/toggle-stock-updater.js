#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const action = process.argv[2];

if (!action || !['enable', 'disable'].includes(action)) {
  console.error('Usage: node toggle-stock-updater.js [enable|disable]');
  process.exit(1);
}

const serverPath = join(__dirname, '../server.js');
const appPath = join(__dirname, '../app.js');

if (action === 'disable') {
  console.log('🔄 Disabling stock updater for development...');
  
  // Disable in server.js
  let serverContent = readFileSync(serverPath, 'utf8');
  
  // Comment out import
  serverContent = serverContent.replace(
    /^import StockUpdater from '\.\/jobs\/stock-updater\.jobs\.js';/m,
    '// import StockUpdater from \'./jobs/stock-updater.jobs.js\';'
  );
  
  // Comment out scheduler blocks - handle both single and double comment patterns
  serverContent = serverContent.replace(
    /(\s+)const stockUpdater = new StockUpdater\(\);/g,
    '$1// const stockUpdater = new StockUpdater();'
  );
  
  serverContent = serverContent.replace(
    /(\s+)\/\/ const stockUpdater = new StockUpdater\(\);/g,
    '$1// const stockUpdater = new StockUpdater();'
  );
  
  serverContent = serverContent.replace(
    /(\s+)stockUpdater\.startScheduler\(interval\);/g,
    '$1// stockUpdater.startScheduler(interval);'
  );
  
  serverContent = serverContent.replace(
    /(\s+)\/\/ stockUpdater\.startScheduler\(interval\);/g,
    '$1// stockUpdater.startScheduler(interval);'
  );
  
  writeFileSync(serverPath, serverContent);
  
  // Disable in app.js
  let appContent = readFileSync(appPath, 'utf8');
  
  // Comment out import
  appContent = appContent.replace(
    /^import StockUpdater from '\.\/jobs\/stock-updater\.jobs\.js';/m,
    '// import StockUpdater from \'./jobs/stock-updater.jobs.js\';'
  );
  
  // Comment out the stockUpdater instantiation
  appContent = appContent.replace(
    /^const stockUpdater = new StockUpdater\(\);$/m,
    '// const stockUpdater = new StockUpdater();'
  );
  
  // Comment out the entire manual endpoint block
  appContent = appContent.replace(
    /(\/\/ Manual stock update endpoint \(for debugging\/admin\)\s*\n)(app\.post\(['"][^'"]*['"], requireAdminAuth[\s\S]*?\}\);\s*\n)/m,
    '$1/*\n$2*/\n'
  );
  
  writeFileSync(appPath, appContent);
  
  console.log('✅ Stock updater disabled for development');
  
} else if (action === 'enable') {
  console.log('🔄 Enabling stock updater for production...');
  
  // Enable in server.js
  let serverContent = readFileSync(serverPath, 'utf8');
  
  // Uncomment import
  serverContent = serverContent.replace(
    /^\/\/ import StockUpdater from '\.\/jobs\/stock-updater\.jobs\.js';/m,
    'import StockUpdater from \'./jobs/stock-updater.jobs.js\';'
  );
  
  // Uncomment scheduler blocks - handle double commented patterns
  serverContent = serverContent.replace(
    /(\s+)\/\/ \/\/ const stockUpdater = new StockUpdater\(\);/g,
    '$1const stockUpdater = new StockUpdater();'
  );
  
  serverContent = serverContent.replace(
    /(\s+)\/\/ const stockUpdater = new StockUpdater\(\);/g,
    '$1const stockUpdater = new StockUpdater();'
  );
  
  serverContent = serverContent.replace(
    /(\s+)\/\/ \/\/ stockUpdater\.startScheduler\(interval\);/g,
    '$1stockUpdater.startScheduler(interval);'
  );
  
  serverContent = serverContent.replace(
    /(\s+)\/\/ stockUpdater\.startScheduler\(interval\);/g,
    '$1stockUpdater.startScheduler(interval);'
  );
  
  writeFileSync(serverPath, serverContent);
  
  // Enable in app.js
  let appContent = readFileSync(appPath, 'utf8');
  
  // Uncomment import
  appContent = appContent.replace(
    /^\/\/ import StockUpdater from '\.\/jobs\/stock-updater\.jobs\.js';/m,
    'import StockUpdater from \'./jobs/stock-updater.jobs.js\';'
  );
  
  // Uncomment the stockUpdater instantiation
  appContent = appContent.replace(
    /^\/\/ const stockUpdater = new StockUpdater\(\);$/m,
    'const stockUpdater = new StockUpdater();'
  );
  
  // Uncomment the manual endpoint block
  appContent = appContent.replace(
    /(\/\/ Manual stock update endpoint \(for debugging\/admin\)\s*\n)\/\*\s*\n(app\.post\(['"][^'"]*['"], requireAdminAuth[\s\S]*?\}\);\s*\n)\*\/\s*\n/m,
    '$1$2'
  );
  
  writeFileSync(appPath, appContent);
  
  console.log('✅ Stock updater enabled for production');
}