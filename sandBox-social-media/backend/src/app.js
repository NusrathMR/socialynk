import cors from 'cors';
import express from 'express';
import postRoutes from './routes/postRoutes.js';

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});

// API Routes
app.use('/api/posts', postRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

// Global Error Handler
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Request body must contain valid JSON.',
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Post validation failed.',
      errors: error.errors,
    });
  }

  console.error('Request failed:', error);
  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
  });
});

export default app;
