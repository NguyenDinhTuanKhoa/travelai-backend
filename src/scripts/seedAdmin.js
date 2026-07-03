const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: 'admin@travelai.com' });
    
    if (existingAdmin) {
      console.log('Admin account already exists!');
      console.log('Email: admin@travelai.com');
      process.exit(0);
    }

    // Create admin
    const admin = await User.create({
      name: 'Admin TravelAI',
      email: 'admin@travelai.com',
      password: 'admin123',
      role: 'admin',
    });

    console.log('✅ Admin account created successfully!');
    console.log('================================');
    console.log('Email: admin@travelai.com');
    console.log('Password: admin123');
    console.log('================================');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
