const AdminActivityLog = require('../models/AdminActivityLog');

/**
 * Fire-and-forget admin activity logger.
 * Không await — không block response.
 */
function logActivity(req, { action, targetModel, targetId, targetLabel, meta }) {
  if (!req?.user?._id) return;
  AdminActivityLog.create({
    admin: req.user._id,
    action,
    targetModel,
    targetId,
    targetLabel: targetLabel || '',
    meta: meta || {},
  }).catch((err) => {
    console.warn('[ActivityLog] Failed to log:', err.message);
  });
}

module.exports = { logActivity };
