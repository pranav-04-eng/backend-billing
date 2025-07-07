import express from 'express';
import { body, validationResult } from 'express-validator';
import { Invoice } from '../models/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';

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
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        invoiceNumber,
        customerEmail,
        invoiceDate,
        dueDate,
        paymentStatus = 'Unpaid'
      } = req.body;

      const invoiceData = {
        invoiceNumber,
        customerEmail,
        invoiceDate: invoiceDate || new Date(),
        dueDate,
        paymentStatus,
      };

      if (req.file) {
        invoiceData.attachmentPath = req.file.path;
        invoiceData.attachmentOriginalName = req.file.originalname;
        invoiceData.attachmentMimeType = req.file.mimetype;
        invoiceData.attachmentSize = req.file.size;
      }

      const invoice = await Invoice.create(invoiceData);
      res.status(201).json({ message: 'Invoice created', invoice });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      console.error('Create invoice error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ✅ Remove price validation in update as well
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
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = { ...req.body };

      if (req.file) {
        const existing = await Invoice.findByPk(id);
        if (existing && existing.attachmentPath) {
          try {
            fs.unlinkSync(existing.attachmentPath);
          } catch {}
        }
        updates.attachmentPath = req.file.path;
        updates.attachmentOriginalName = req.file.originalname;
        updates.attachmentMimeType = req.file.mimetype;
        updates.attachmentSize = req.file.size;
      }

      const [updated] = await Invoice.update(updates, { where: { id } });
      if (!updated) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Invoice not found' });
      }

      const invoice = await Invoice.findByPk(id);
      res.json({ message: 'Invoice updated', invoice });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      console.error('Update invoice error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get(
  '/search/:invoiceNumber',
  authenticateToken,
  async (req, res) => {
    try {
      const { invoiceNumber } = req.params;
      const invoice = await Invoice.findOne({ where: { invoiceNumber } });

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
    const invoices = await Invoice.findAll({ where: { customerEmail: email } });
    res.json({ invoices });
  } catch (error) {
    console.error('Fetch invoices by email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;
