const cron = require('node-cron');
const { fetchDestinations } = require('../services/osmSyncService');

// Schedule tasks to run daily at 00:00 (midnight server time)
cron.schedule('0 0 * * *', () => {
    console.log('[Cron Job] Executing OSM Destinations Sync');
    fetchDestinations();
});

console.log('[Cron] initialized fetchDestinations scheduled job.');