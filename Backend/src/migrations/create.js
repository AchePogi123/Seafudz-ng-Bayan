import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nameArg = process.argv[2];

if (!nameArg) {
  console.error('❌ Please provide a migration description name.');
  console.error('👉 Usage: npm run migrate:create add_discount_column_to_orders');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
const sanitizedName = nameArg.toLowerCase().replace(/[^a-z0-9_]/g, '_');
const filename = `${timestamp}_${sanitizedName}.sql`;
const filePath = path.join(__dirname, filename);

const template = `-- =====================================================================
-- ${filename}
-- Created At: ${new Date().toISOString()}
-- Description: ${nameArg}
-- =====================================================================

-- Write your SQL migration script below:

`;

fs.writeFileSync(filePath, template, 'utf8');
console.log(`✨ Created new migration file: ${filePath}`);
