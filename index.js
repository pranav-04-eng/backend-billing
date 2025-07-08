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
const PORT = process.env.PORT;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://frontend-billing.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);

// Connect to PostgreSQL
connectDB();

// Debug: Log current time and timezone
console.log('Current time:', new Date().toISOString());
console.log('Local time:', new Date().toLocaleString());
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

// Test cron job - runs every minute for testing
const testCron = cron.schedule('* * * * *', () => {
  console.log('Test cron running every minute:', new Date().toLocaleString());
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Main cron job - Daily at 10:05 AM IST
const dailyCron = cron.schedule('28 10 * * *', async () => {
  console.log('Running daily overdue email reminders at:', new Date().toLocaleString());
  try {
    await sendOverdueReminders();
    console.log('Overdue email reminders sent successfully');
  } catch (error) {
    console.error('Error sending overdue reminders:', error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Alternative: If you want to use UTC time (4:35 AM UTC = 10:05 AM IST)
// const dailyCronUTC = cron.schedule('35 4 * * *', async () => {
//   console.log('Running daily overdue email reminders (UTC):', new Date().toISOString());
//   try {
//     await sendOverdueReminders();
//     console.log('Overdue email reminders sent successfully');
//   } catch (error) {
//     console.error('Error sending overdue reminders:', error);
//   }
// }, {
//   scheduled: true
// });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    database: 'PostgreSQL',
    cronJobs: {
      testCron: testCron.getStatus(),
      dailyCron: dailyCron.getStatus()
    }
  });
});

// Manual trigger endpoint for testing
app.post('/api/trigger-reminders', async (req, res) => {
  try {
    console.log('Manually triggering overdue reminders...');
    await sendOverdueReminders();
    res.json({ success: true, message: 'Reminders sent successfully' });
  } catch (error) {
    console.error('Error in manual trigger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  testCron.stop();
  dailyCron.stop();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Manual trigger: http://localhost:${PORT}/api/trigger-reminders`);
  console.log('⏰ Cron jobs initialized');
});