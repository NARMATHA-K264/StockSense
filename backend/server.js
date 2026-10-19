const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const productRoutes = require('./routes/productRoutes');
const storeRoutes = require('./routes/storeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const replenishmentRoutes = require('./routes/replenishmentRoutes');
const storeMapRoutes = require('./routes/storeMapRoutes');
const { verifySmtpTransport } = require('./utils/invitationService');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;
const allowedOrigins = ['http://localhost:5173', 'http://10.131.219.141:5173','https://stocksense-isui.onrender.com'];

mongoose.set('strictQuery', true);

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected; awaiting reconnect...');
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores/map', storeMapRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/replenishment', replenishmentRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'StockSense API is running',
  });
});

const startServer = async () => {
  try {
    if (!mongoUri) {
      throw new Error('MONGO_URI is not configured');
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
      retryWrites: true,
      tls: true,
    });

    console.log('Connected to MongoDB');

    try {
      await verifySmtpTransport();
      console.log('SMTP transporter ready');
    } catch (smtpError) {
      console.error('SMTP configuration error:', smtpError.message);
    }

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

startServer();


