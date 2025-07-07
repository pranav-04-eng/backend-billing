import nodemailer from 'nodemailer';
import { Invoice } from '../models/index.js';
import { Op } from 'sequelize';

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send overdue reminder email
const sendOverdueEmail = async (invoice) => {
  const transporter = createTransporter();
  
  const daysPastDue = Math.ceil((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: invoice.customerEmail,
    subject: `Payment Reminder - Invoice ${invoice.invoiceNumber} is Overdue`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #dc3545; margin-bottom: 20px;">Payment Reminder</h2>
          
          <p>Dear Customer,</p>
          
          <p>This is a friendly reminder that your invoice is now overdue for payment.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="margin-top: 0; color: #333;">Invoice Details</h3>
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Amount:</strong> $${parseFloat(invoice.amount).toFixed(2)}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p><strong>Days Overdue:</strong> ${daysPastDue} days</p>
            ${invoice.description ? `<p><strong>Description:</strong> ${invoice.description}</p>` : ''}
          </div>
          
          <p>Please arrange payment as soon as possible to avoid any late fees or service interruptions.</p>
          
          <p>If you have already made this payment, please disregard this notice. If you have any questions or concerns, please contact us immediately.</p>
          
          <p>Thank you for your prompt attention to this matter.</p>
          
          <p>Best regards,<br>
          Billing Department</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Overdue reminder sent to ${invoice.customerEmail} for invoice ${invoice.invoiceNumber}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${invoice.customerEmail}:`, error);
    return false;
  }
};

// Send overdue reminders to all customers
export const sendOverdueReminders = async () => {
  try {
    // Find all overdue unpaid invoices
    const overdueInvoices = await Invoice.findAll({
      where: {
        dueDate: { [Op.lt]: new Date() },
        paymentStatus: 'Unpaid',
        isActive: true
      }
    });

    console.log(`Found ${overdueInvoices.length} overdue invoices`);

    let successCount = 0;
    let failureCount = 0;

    for (const invoice of overdueInvoices) {
      const emailSent = await sendOverdueEmail(invoice);
      
      if (emailSent) {
        successCount++;
        // Update reminder sent timestamp
        await Invoice.update(
          { reminderSent: new Date() },
          { where: { id: invoice.id } }
        );
      } else {
        failureCount++;
      }
      
      // Add delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Email reminders completed: ${successCount} sent, ${failureCount} failed`);
    
    return {
      total: overdueInvoices.length,
      success: successCount,
      failures: failureCount
    };
  } catch (error) {
    console.error('Error in sendOverdueReminders:', error);
    throw error;
  }
};

// Send new invoice notification
export const sendInvoiceNotification = async (invoice) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: invoice.customerEmail,
    subject: `New Invoice - ${invoice.invoiceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #007bff; margin-bottom: 20px;">New Invoice</h2>
          
          <p>Dear Customer,</p>
          
          <p>A new invoice has been generated for your account.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
            <h3 style="margin-top: 0; color: #333;">Invoice Details</h3>
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Amount:</strong> $${parseFloat(invoice.amount).toFixed(2)}</p>
            <p><strong>Invoice Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            ${invoice.description ? `<p><strong>Description:</strong> ${invoice.description}</p>` : ''}
          </div>
          
          <p>Please ensure payment is made by the due date to avoid any late fees.</p>
          
          <p>Thank you for your business!</p>
          
          <p>Best regards,<br>
          Billing Department</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Invoice notification sent to ${invoice.customerEmail} for invoice ${invoice.invoiceNumber}`);
    return true;
  } catch (error) {
    console.error(`Failed to send invoice notification to ${invoice.customerEmail}:`, error);
    return false;
  }
};