import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Keep worker startup resilient when .env is missing in local MVP setup.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/leadgen';
}

// Import all workers - this starts them automatically
import './leads.worker';
import './apollo.worker';
import './google.worker';
import './clearbit.worker';
import './hunter.worker';
import './peopledatalabs.worker';
import './message.worker';
import './sequence.worker';

console.log('🚀 All workers initialized and running');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Shutting down workers...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down workers...');
  process.exit(0);
});
