import Sequelize  from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL for cloud services (TiDB Cloud, PlanetScale, etc.)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        // Adjust this based on your TiDB/MySQL provider
        rejectUnauthorized: true,
      },
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
} else {
  // Use individual connection parameters for local development
  sequelize = new Sequelize(
    process.env.DB_NAME || 'billing_system',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL/TiDB connected successfully');

    // Sync all models (create tables if not exist)
    const models = await import('../models/index.js');
    await sequelize.sync(); // Use { force: true } if you want to drop and recreate tables

    console.log('✅ Database models synchronized');

    // Check and create default admin
    const { User } = models;
    const adminExists = await User.findOne({ where: { email: 'admin@billing.com' } });

    if (!adminExists) {
      await User.create({
        email: 'admin@billing.com',
        password: 'password',
        name: 'Admin User',
        role: 'admin'
      });
      console.log('✅ Default admin user created');
    }

  } catch (error) {
    console.error('❌ MySQL/TiDB connection error:', error.message);
    console.log('');
    console.log('🔧 Database connection failed. Please check:');
    console.log('1. Database URL is correct');
    console.log('2. Database server is accessible');
    console.log('3. Credentials are valid');
    console.log('');
    console.log('⚠️  Server will continue running but database operations will fail');
    console.log('');
  }
};

export default sequelize;
