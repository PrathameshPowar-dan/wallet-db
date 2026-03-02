import { pool } from '../db.js';
import crypto from 'crypto';

// Get Wallet Balance
export const getWalletBalance = async (req, res) => {
    const clientId = req.headers['client-id']; // Extract from headers

    if (!clientId) return res.status(400).json({ error: 'client-id header is required' });

    try {
        const result = await pool.query('SELECT balance FROM wallets WHERE client_id = $1', [clientId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });

        res.json({ balance: result.rows[0].balance }); //
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get Order Details
export const getOrderDetails = async (req, res) => {
    const clientId = req.headers['client-id']; //
    const { order_id } = req.params; //

    if (!clientId) return res.status(400).json({ error: 'client-id header is required' });

    try {
        const result = await pool.query(
            'SELECT id, amount, status, fulfillment_id, created_at FROM orders WHERE id = $1 AND client_id = $2',
            [order_id, clientId]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

        res.json(result.rows[0]); // Returns amount, status, and fulfillment ID
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create Order
export const createOrder = async (req, res) => {
    const clientId = req.headers['client-id']; //
    const { amount } = req.body; //

    if (!clientId) return res.status(400).json({ error: 'client-id header is required' });
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Positive amount is required' });

    const orderId = crypto.randomUUID();
    const dbClient = await pool.connect();

    try {
        // --- Atomic Database Deduction ---
        await dbClient.query('BEGIN');

        // Validate wallet balance
        const walletResult = await dbClient.query(
            'SELECT balance FROM wallets WHERE client_id = $1 FOR UPDATE',
            [clientId]
        );

        if (walletResult.rowCount === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Wallet not found' });
        }

        if (parseFloat(walletResult.rows[0].balance) < amount) {
            await dbClient.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deducts amount from wallet atomically
        await dbClient.query(
            'UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE client_id = $2',
            [amount, clientId]
        );

        await dbClient.query(
            "INSERT INTO ledger (client_id, amount, transaction_type) VALUES ($1, $2, 'ORDER_PAYMENT')",
            [clientId, amount]
        );

        // Creates the order (initial state: PENDING)
        await dbClient.query(
            "INSERT INTO orders (id, client_id, amount, status) VALUES ($1, $2, $3, 'PENDING')",
            [orderId, clientId, amount]
        );

        await dbClient.query('COMMIT'); 
        dbClient.release(); // Release DB lock BEFORE calling external API

        // --- External Fulfillment API Call ---
        let fulfillmentId = null;
        let finalStatus = 'FAILED';

        try {
            // Calls fulfillment API
            const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, //
                body: JSON.stringify({ 
                    userId: clientId, //
                    title: orderId //
                })
            });

            if (response.ok) {
                const data = await response.json();
                fulfillmentId = data.id.toString(); // Stores the returned id
                finalStatus = 'FULFILLED';
            }
        } catch (apiError) {
            console.error('External API call failed:', apiError);
            // If it fails, finalStatus remains 'FAILED'
        }

        // We use the general pool query here since the transaction is already over
        await pool.query(
            'UPDATE orders SET status = $1, fulfillment_id = $2 WHERE id = $3',
            [finalStatus, fulfillmentId, orderId]
        );

        res.status(201).json({
            message: 'Order processed',
            order_id: orderId,
            amount: amount,
            status: finalStatus,
            fulfillment_id: fulfillmentId
        });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        dbClient.release();
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};