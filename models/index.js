import User from './User.js';
import Invoice from './Invoice.js';

// Define associations if needed
// User.hasMany(Invoice, { foreignKey: 'customerEmail', sourceKey: 'email' });
// Invoice.belongsTo(User, { foreignKey: 'customerEmail', targetKey: 'email' });

export { User, Invoice };