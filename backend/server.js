import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import connectDB from './db.js';
import authRoutes from './routes/auth.js';
import { protect } from './middleware/auth.js';
import {
  analyzeDocument,
  getDocuments,
  getAnalytics,
  chatWithDocument,
  syncToERP,
} from './controllers/documentController.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max file size
});

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.post('/api/documents/analyze', protect, upload.single('file'), analyzeDocument);
app.get('/api/documents/analytics', protect, getAnalytics);
app.get('/api/documents', protect, getDocuments);
app.post('/api/documents/:id/chat', protect, chatWithDocument);
app.patch('/api/documents/:id/sync', protect, syncToERP);

// Multer & general error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 30MB limit.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    console.error('Server error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
  }
  next();
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
