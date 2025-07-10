import express from 'express';
import { body, validationResult } from 'express-validator';
import { Invoice } from '../models/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';

const router = express.Router();

// Create invoice (Admin only) with PDF upload
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  upload.single('attachment'),
  [
    body('invoiceNumber').trim().notEmpty().withMessage('Invoice number is required'),
    body('customerEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('invoiceDate').optional().isISO8601(),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    body('paymentStatus').optional().isIn(['Paid', 'Unpaid']),
    body('invoiceAmount').isDecimal().withMessage('Valid invoice amount is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        invoiceNumber,
        customerEmail,
        invoiceDate,
        dueDate,
        paymentStatus = 'Unpaid',
        invoiceAmount
      } = req.body;

      const invoiceData = {
        invoiceNumber,
        customerEmail,
        invoiceDate: invoiceDate || new Date(),
        dueDate,
        paymentStatus,
        invoiceAmount,
      };

      // Store PDF data in database if file is uploaded
      if (req.file) {
        try {
          // File is already in memory buffer due to memoryStorage
          const pdfBuffer = req.file.buffer;
          
          // Store PDF data in database
          invoiceData.pdfData = pdfBuffer;
          invoiceData.pdfFileName = req.file.originalname;
          invoiceData.pdfMimeType = req.file.mimetype;
          invoiceData.pdfSize = req.file.size;
        } catch (fileError) {
          console.error('Error processing PDF file:', fileError);
          return res.status(500).json({ message: 'Error processing PDF file' });
        }
      }

      const invoice = await Invoice.create(invoiceData);
      
      // Remove pdfData from response to avoid sending large binary data
      const responseInvoice = { ...invoice.toJSON() };
      delete responseInvoice.pdfData;
      
      res.status(201).json({ message: 'Invoice created', invoice });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update invoice (Admin only) with PDF upload
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  upload.single('attachment'),
  [
    body('invoiceNumber').optional().trim().notEmpty(),
    body('customerEmail').optional().isEmail().normalizeEmail(),
    body('invoiceDate').optional().isISO8601(),
    body('dueDate').optional().isISO8601(),
    body('paymentStatus').optional().isIn(['Paid', 'Unpaid']),
    body('invoiceAmount').optional().isDecimal().withMessage('Invoice amount must be a number'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = { ...req.body };

      // Handle PDF file update
      if (req.file) {
        try {
          // File is already in memory buffer due to memoryStorage
          const pdfBuffer = req.file.buffer;
          
          // Update PDF data in database
          updates.pdfData = pdfBuffer;
          updates.pdfFileName = req.file.originalname;
          updates.pdfMimeType = req.file.mimetype;
          updates.pdfSize = req.file.size;
        } catch (fileError) {
          console.error('Error processing PDF file:', fileError);
          return res.status(500).json({ message: 'Error processing PDF file' });
        }
      }

      const [updated] = await Invoice.update(updates, { where: { id } });
      if (!updated) {
        return res.status(404).json({ message: 'Invoice not found' });
      }

      const invoice = await Invoice.findByPk(id);
      
      // Remove pdfData from response to avoid sending large binary data
      const responseInvoice = { ...invoice.toJSON() };
      delete responseInvoice.pdfData;
      
      res.json({ message: 'Invoice updated', invoice: responseInvoice });
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get all invoices (Admin only) - exclude PDF data for performance
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      attributes: { exclude: ['pdfData'] }, // Exclude binary data for list view
      order: [['createdAt', 'DESC']]
    });
    res.json({ invoices });
  } catch (error) {
    console.error('Fetch invoices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download PDF file
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id, {
      attributes: ['id', 'invoiceNumber', 'pdfData', 'pdfFileName', 'pdfMimeType', 'pdfSize', 'customerEmail']
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if user has permission to access this invoice
    if (req.user.role !== 'admin' && req.user.email !== invoice.customerEmail) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!invoice.pdfData) {
      return res.status(404).json({ message: 'PDF not found for this invoice' });
    }

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', invoice.pdfMimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.pdfFileName || `invoice-${invoice.invoiceNumber}.pdf`}"`);
    res.setHeader('Content-Length', invoice.pdfSize || invoice.pdfData.length);

    // Send the PDF data
    res.send(invoice.pdfData);
  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// View PDF in browser (inline)
router.get('/:id/pdf/view', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id, {
      attributes: ['id', 'invoiceNumber', 'pdfData', 'pdfFileName', 'pdfMimeType', 'pdfSize', 'customerEmail']
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if user has permission to access this invoice
    if (req.user.role !== 'admin' && req.user.email !== invoice.customerEmail) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!invoice.pdfData) {
      return res.status(404).json({ message: 'PDF not found for this invoice' });
    }

    // Set appropriate headers for PDF viewing in browser
    res.setHeader('Content-Type', invoice.pdfMimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfFileName || `invoice-${invoice.invoiceNumber}.pdf`}"`);
    res.setHeader('Content-Length', invoice.pdfSize || invoice.pdfData.length);

    // Send the PDF data
    res.send(invoice.pdfData);
  } catch (error) {
    console.error('View PDF error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get(
  '/search/:invoiceNumber',
  authenticateToken,
  async (req, res) => {
    try {
      const { invoiceNumber } = req.params;
      const invoice = await Invoice.findOne({ 
        where: { invoiceNumber },
        attributes: { exclude: ['pdfData'] } // Exclude binary data for search results
      });

      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }

      res.json({ invoice });
    } catch (error) {
      console.error('Search invoice error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get('/customer', authenticateToken, async (req, res) => {
  const { email } = req.query;
  try {
    const invoices = await Invoice.findAll({ 
      where: { customerEmail: email },
      attributes: { exclude: ['pdfData'] }, // Exclude binary data for customer view
      order: [['createdAt', 'DESC']]
    });
    res.json({ invoices });
  } catch (error) {
    console.error('Fetch invoices by email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get invoice details with PDF info (but not PDF data)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id, {
      attributes: { exclude: ['pdfData'] } // Exclude binary data, but include other PDF info
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if user has permission to access this invoice
    if (req.user.role !== 'admin' && req.user.email !== invoice.customerEmail) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete invoice (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Invoice.destroy({ where: { id } });
    
    if (!deleted) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
