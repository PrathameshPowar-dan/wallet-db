import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { creditWallet, debitWallet } from './controllers/adminController.js';
import { getWalletBalance, getOrderDetails, createOrder } from './controllers/clientController.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ADMIN APIs ---
app.post('/admin/wallet/credit', creditWallet);
app.post('/admin/wallet/debit', debitWallet);

// --- CLIENT APIs ---
app.post('/orders', createOrder); //
app.get('/orders/:order_id', getOrderDetails);
app.get('/wallet/balance', getWalletBalance);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});