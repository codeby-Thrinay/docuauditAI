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
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.post('/api/documents/analyze', protect, upload.single('file'), analyzeDocument);
app.get('/api/documents/analytics', protect, getAnalytics);
app.get('/api/documents', protect, getDocuments);
app.post('/api/documents/:id/chat', protect, chatWithDocument);
app.patch('/api/documents/:id/sync', protect, syncToERP);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
