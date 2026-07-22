import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import contractsRouter from './routes/contracts/index.js';
import notingRouter from './routes/noting/index.js';
import paymentAdvicesRouter from './routes/paymentAdvices.js';
import rvsRouter from './routes/rvs.js';

const app = express();
app.use(express.json());

// Open routes
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

// Protected data routes — require a valid Bearer JWT
app.use('/api/rvs', authMiddleware, rvsRouter);
app.use('/api/payment-advices', authMiddleware, paymentAdvicesRouter);
app.use('/api/ai', authMiddleware, aiRouter);
app.use('/api/noting', authMiddleware, notingRouter);
app.use('/api/contracts', authMiddleware, contractsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Mock API listening on http://localhost:${PORT}`));
