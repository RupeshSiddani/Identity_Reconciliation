import express from 'express';
import dotenv from 'dotenv';
import identifyRouter from './routes/identify';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/', identifyRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Identity Reconciliation API is running.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
