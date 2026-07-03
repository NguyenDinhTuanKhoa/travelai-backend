const mongoose = require('mongoose');

const adminActivityLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'bulk_delete', 'ban', 'unban', 'role_change'],
    required: true,
  },
  targetModel: {
    type: String,
    enum: ['User', 'Destination', 'Review', 'Itinerary', 'ChatHistory'],
    required: true,
  },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetLabel: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

adminActivityLogSchema.index({ admin: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetModel: 1, targetId: 1 });

module.exports = mongoose.model('AdminActivityLog', adminActivityLogSchema);
