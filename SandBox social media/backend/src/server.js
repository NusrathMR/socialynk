import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import connectDB from './config/db.js';
import Post from './models/Post.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const port = Number(process.env.PORT) || 5000;

export const startServer = async () => {
  await connectDB();
  await Post.init();

  return app.listen(port, () => {
    console.log(`Sandbox Social API listening on http://localhost:${port}`);
  });
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((error) => {
    console.error('Unable to start Sandbox Social API:', error.message);
    process.exitCode = 1;
  });
}

export default startServer;
