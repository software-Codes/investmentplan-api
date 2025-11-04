const { DataSource } = require('typeorm');
require('dotenv').config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  entities: [__dirname + '/../entities/**/*.js'],
  migrations: [__dirname + '/../migrations/**/*.js'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

module.exports = { AppDataSource };
