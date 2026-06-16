// Database Setup Script for UK Aesthetics Lead Engine
// Run this script to setup PostgreSQL database and run Prisma migrations

const { execSync } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔧 Setting up UK Aesthetics Lead Engine database...\n');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  console.log('Please create a .env file with DATABASE_URL="postgresql://username:password@localhost:5432/aesthetics_leads_db"');
  process.exit(1);
}

try {
  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { cwd: path.join(__dirname), stdio: 'inherit' });

  // Create database migration
  console.log('\n🔄 Creating database migration...');
  execSync('npx prisma migrate dev --name init', { cwd: path.join(__dirname), stdio: 'inherit' });

  // Seed database (optional)
  console.log('\n🌱 Database setup complete!');
  console.log('\n✅ Next steps:');
  console.log('1. Update .env with your API keys');
  console.log('2. Run: npm install (in both backend/ and dashboard/)');
  console.log('3. Run: npm run dev (to start development server)');

} catch (error) {
  console.error('\n❌ Database setup failed:', error.message);
  console.log('\nMake sure PostgreSQL is running and DATABASE_URL is correct');
  process.exit(1);
}
