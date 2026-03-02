import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query, pool } from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ADMIN APIs ---

// Credit Wallet
app.post('/admin/wallet/credit', async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
});

// Debit Wallet
app.post('/admin/wallet/debit', async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
});

// --- CLIENT APIs ---

// Create Order
app.post('/orders', async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
});

// Get Order Details
app.get('/orders/:order_id', async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
});

// Wallet Balance
app.get('/wallet/balance', async (req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});