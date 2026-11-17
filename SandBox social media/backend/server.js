require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const cors = require('cors');
const express = require('express');
const connectDB = require('./config/db');
const Post = require('./models/Post');
const postRoutes = require('./routes/postRoutes');

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
// URLs and media metadata are sent as JSON; this allows image galleries without
// accepting or storing uploaded file bytes on the Sandbox server.
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});
app.use('/api/posts', postRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body must contain valid JSON.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Post validation failed.', errors: error.errors });
  }
  console.error('Request failed:', error);
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

async function startServer() {
  await connectDB();
  await Post.init();
  return app.listen(port, () => {
    console.log(`Sandbox Social API listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start Sandbox Social API:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
