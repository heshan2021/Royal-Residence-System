// pages/api/admin/expenses.ts
// Expenses API - Create and list business expenses

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, expenses, NewExpense } from '../../../src/db';
import { desc } from 'drizzle-orm';

// Type definitions for API requests/responses
interface CreateExpenseRequest {
  amount: number;
  category: string;
  description?: string;
}

interface ExpenseResponse {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expenseDate: string;
  createdAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExpenseResponse[] | ExpenseResponse | { error: string }>
) {
  if (req.method === 'GET') {
    try {
      // Get all expenses, ordered by most recent first
      const allExpenses = await db
        .select()
        .from(expenses)
        .orderBy(desc(expenses.createdAt));

      // Convert to API response format
      const response: ExpenseResponse[] = allExpenses.map(expense => ({
        id: expense.id,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        expenseDate: expense.expenseDate!.toISOString(), // Non-null assertion since we have defaults
        createdAt: expense.createdAt!.toISOString(), // Non-null assertion since we have defaults
      }));

      return res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      // If table doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes('expenses')) {
        return res.status(200).json([]);
      }
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch expenses' 
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const { amount, category, description } = req.body as CreateExpenseRequest;

      // Validate required fields
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Amount is required and must be positive' });
      }

      if (!category || !['Marketing', 'Maintenance', 'Guest Supplies', 'Utilities', 'Other'].includes(category)) {
        return res.status(400).json({ error: 'Valid category is required' });
      }

      // Create new expense
      const newExpense: NewExpense = {
        amount,
        category: category as any, // Type assertion since we validated above
        description: description || null,
      };

      const [createdExpense] = await db
        .insert(expenses)
        .values(newExpense)
        .returning();

      // Convert to API response format
      const response: ExpenseResponse = {
        id: createdExpense.id,
        amount: createdExpense.amount,
        category: createdExpense.category,
        description: createdExpense.description,
        expenseDate: createdExpense.expenseDate!.toISOString(), // Non-null assertion since we have defaults
        createdAt: createdExpense.createdAt!.toISOString(), // Non-null assertion since we have defaults
      };

      return res.status(201).json(response);
    } catch (error) {
      console.error('Error creating expense:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create expense' 
      });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}