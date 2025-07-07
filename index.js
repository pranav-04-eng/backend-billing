import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import invoiceRoutes from './routes/invoices.js';
import { sendOverdueReminders } from './services/emailService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);

// Connect to PostgreSQL
connectDB();

// Schedule daily email reminders at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily overdue email reminders...');
  try {
    await sendOverdueReminders();
    console.log('Overdue email reminders sent successfully');
  } catch (error) {
    console.error('Error sending overdue reminders:', error);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    database: 'PostgreSQL'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});