import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('invoiceNumber', value.trim().toUpperCase());
    },
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
    set(value) {
      this.setDataValue('customerEmail', value.toLowerCase().trim());
    },
  },
  invoiceDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  paymentStatus: {
    type: DataTypes.ENUM('Paid', 'Unpaid'),
    allowNull: false,
    defaultValue: 'Unpaid',
  },
  pdfUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pdfData: {
    type: DataTypes.BLOB('long'), // Store PDF as binary data
    allowNull: true,
  },
  pdfFileName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pdfMimeType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'application/pdf',
  },
  pdfSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  invoiceAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
}, {
  tableName: 'invoices',
  timestamps: true,
  indexes: [
    { fields: ['invoiceNumber'], unique: true },
    { fields: ['customerEmail'] },
    { fields: ['dueDate'] },
    { fields: ['paymentStatus'] },
  ],
});

export default Invoice;