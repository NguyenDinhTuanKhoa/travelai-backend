const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  type: { type: String, enum: ['direct', 'group'], default: 'direct' },
  name: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

conversationSchema.index({ participants: 1, lastActivity: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
