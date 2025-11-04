require('dotenv').config();

module.exports = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  },
  entities: ['src/database/entities/**/*.js'],
  migrations: ['src/database/migrations/**/*.js'],
  subscribers: ['src/database/subscribers/**/*.js'],
  cli: {
    entitiesDir: 'src/database/entities',
    migrationsDir: 'src/database/migrations',
    subscribersDir: 'src/database/subscribers'
  },
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  migrationsRun: false
};
