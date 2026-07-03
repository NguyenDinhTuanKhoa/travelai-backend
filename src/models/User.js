const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { 
    type: String, 
    required: function() {
      return !this.googleId;
    }
  },
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBanned: { type: Boolean, default: false },
  bannedAt: { type: Date },
  banReason: { type: String, default: '' },
  preferences: {
    travelStyle: [String],
    budget: { type: String, enum: ['low', 'medium', 'high'] },
    interests: [String]
  },
  savedDestinations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Destination' }],
  searchHistory: [{ query: String, date: { type: Date, default: Date.now } }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
