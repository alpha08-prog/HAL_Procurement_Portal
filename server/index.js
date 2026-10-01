import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import aiRouter from './routes/ai.js';
import approvalsRouter from './routes/approvals/index.js';
import authRouter from './routes/auth.js';
import claimsRouter from './routes/claims.js';
import contractsRouter from './routes/contracts/index.js';
import formatsRouter from './routes/formats.js';
import kpisRouter from './routes/kpis.js';
import notingRouter from './routes/noting/index.js';
import paymentAdvicesRouter from './routes/paymentAdvices.js';
import requisitionsRouter from './routes/requisitions.js';
import rvsRouter from './routes/rvs.js';
import trackersRouter from './routes/trackers.js';

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
app.use('/api/approvals', authMiddleware, approvalsRouter);
app.use('/api/formats', authMiddleware, formatsRouter);
app.use('/api/trackers', authMiddleware, trackersRouter);
app.use('/api/requisitions', authMiddleware, requisitionsRouter);
app.use('/api/claims', authMiddleware, claimsRouter);
app.use('/api/kpis', authMiddleware, kpisRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`HAL portal API listening on http://localhost:${PORT}`));
