import { pool } from '../db.js';

// 1. Admin Credit Wallet
export const creditWallet = async (req, res) => {
    const { client_id, amount } = req.body; // [cite: 17]

    if (!client_id || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Valid client_id and positive amount are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Adds amount to wallet [cite: 18]
        const walletResult = await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE client_id = $2 RETURNING balance',
            [amount, client_id]
        );

        if (walletResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Wallet not found' });
        }

        // Creates a ledger entry [cite: 18]
        await client.query(
            "INSERT INTO ledger (client_id, amount, transaction_type) VALUES ($1, $2, 'CREDIT')",
            [client_id, amount]
        );

        await client.query('COMMIT');
        res.json({ message: 'Wallet credited successfully', balance: walletResult.rows[0].balance });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Credit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

// 2. Admin Debit Wallet
export const debitWallet = async (req, res) => {
    const { client_id, amount } = req.body; // [cite: 22]

    if (!client_id || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Valid client_id and positive amount are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch current balance AND lock the row
        const walletResult = await client.query(
            'SELECT balance FROM wallets WHERE client_id = $1 FOR UPDATE',
            [client_id]
        );

        if (walletResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const currentBalance = parseFloat(walletResult.rows[0].balance);

        // Validates wallet balance [cite: 29]
        if (currentBalance < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deducts amount if balance is sufficient [cite: 23]
        const updatedWallet = await client.query(
            'UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE client_id = $2 RETURNING balance',
            [amount, client_id]
        );

        // Logs a transaction [cite: 23]
        await client.query(
            "INSERT INTO ledger (client_id, amount, transaction_type) VALUES ($1, $2, 'DEBIT')",
            [client_id, amount]
        );

        await client.query('COMMIT');
        res.json({ message: 'Wallet debited successfully', balance: updatedWallet.rows[0].balance });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Debit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};