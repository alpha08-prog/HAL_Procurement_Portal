import express from 'express';
import paymentAdvicesRouter from './routes/paymentAdvices.js';
import rvsRouter from './routes/rvs.js';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/rvs', rvsRouter);
app.use('/api/payment-advices', paymentAdvicesRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Mock API listening on http://localhost:${PORT}`));
