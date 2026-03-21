// pages/api/admin/accounting-stats.ts
// Accounting Statistics API - Owner's Overview
// Uses Drizzle ORM for all aggregate calculations

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, transactions, bookings, expenses } from '../../../src/db';
import { eq, sql, and, gte, lt } from 'drizzle-orm';

// Type definitions for API response
export interface MonthlyFinancialItem {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface PaymentMethodSplit {
  cash: number;
  bank: number;
}

export interface ExpensesByCategory {
  Marketing: number;
  Maintenance: number;
  'Guest Supplies': number;
  Utilities: number;
  Other: number;
}

export interface AccountingStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  todayCollection: number;
  pendingBalance: number;
  paymentMethodSplit: PaymentMethodSplit;
  monthlyFinancials: MonthlyFinancialItem[];
  expensesByCategory: ExpensesByCategory;
  revenueGrowth: number;
  currentMonthTotal: number;
  lastMonthTotal: number;
}

// Month names for display
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountingStats | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent Vercel edge caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Get today's date boundaries (Sri Lanka timezone UTC+5:30)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Current year for monthly data
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // ========================================================================
    // 1. Total Revenue: SUM of all transaction amounts
    // ========================================================================
    const totalRevenueResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions);
    
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // ========================================================================
    // 2. Today's Collection: SUM of today's transaction amounts
    // ========================================================================
    const todayCollectionResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.createdAt, todayStart),
          lt(transactions.createdAt, todayEnd)
        )
      );
    
    const todayCollection = todayCollectionResult[0]?.total || 0;

    // ========================================================================
    // 3. Pending Balance: Active bookings total - paid transactions
    // ========================================================================
    const activeBookingsResult = await db
      .select({
        totalBookingAmount: sql<number>`COALESCE(SUM(${bookings.totalPrice}), 0)::integer`
      })
      .from(bookings)
      .where(eq(bookings.status, 'active'));
    
    const totalBookingAmount = activeBookingsResult[0]?.totalBookingAmount || 0;
    
    const paidAmountResult = await db
      .select({
        totalPaidAmount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .innerJoin(bookings, eq(transactions.bookingId, bookings.id))
      .where(eq(bookings.status, 'active'));
    
    const totalPaidAmount = paidAmountResult[0]?.totalPaidAmount || 0;
    
    const pendingBalance = Math.max(0, totalBookingAmount - totalPaidAmount);

    // ========================================================================
    // 4. Payment Method Split: Count of Cash vs Bank transactions
    // ========================================================================
    const paymentSplitResult = await db
      .select({
        method: transactions.paymentMethod,
        count: sql<number>`COUNT(*)::integer`
      })
      .from(transactions)
      .groupBy(transactions.paymentMethod);
    
    const paymentMethodSplit: PaymentMethodSplit = {
      cash: 0,
      bank: 0
    };
    
    paymentSplitResult.forEach((row) => {
      if (row.method === 'Cash') {
        paymentMethodSplit.cash = row.count;
      } else if (row.method === 'Bank') {
        paymentMethodSplit.bank = row.count;
      }
    });

    // ========================================================================
    // 5. Total Expenses: SUM of all expense amounts
    // ========================================================================
    let totalExpenses = 0;
    let expensesByCategory: ExpensesByCategory = {
      Marketing: 0,
      Maintenance: 0,
      'Guest Supplies': 0,
      Utilities: 0,
      Other: 0
    };

    try {
      const totalExpensesResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)::integer`
        })
        .from(expenses);
      
      totalExpenses = totalExpensesResult[0]?.total || 0;

      const expensesByCategoryResult = await db
        .select({
          category: expenses.category,
          total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)::integer`
        })
        .from(expenses)
        .groupBy(expenses.category);

      expensesByCategoryResult.forEach((row) => {
        expensesByCategory[row.category as keyof ExpensesByCategory] = row.total;
      });
    } catch (error) {
      console.log('Expenses table not available yet, using defaults:', error instanceof Error ? error.message : String(error));
    }

    // ========================================================================
    // 6. Net Profit: Total Revenue - Total Expenses
    // ========================================================================
    const netProfit = totalRevenue - totalExpenses;

    // ========================================================================
    // 7. Monthly Financial Data
    // ========================================================================
    const monthlyRevenueResult = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${transactions.createdAt})::integer`,
        revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .where(sql`EXTRACT(YEAR FROM ${transactions.createdAt}) = ${currentYear}`)
      .groupBy(sql`EXTRACT(MONTH FROM ${transactions.createdAt})`)
      .orderBy(sql`EXTRACT(MONTH FROM ${transactions.createdAt})`);

    const revenueMap = new Map<number, number>();
    monthlyRevenueResult.forEach((row) => {
      revenueMap.set(row.month, row.revenue);
    });

    const expensesMap = new Map<number, number>();
    try {
      const monthlyExpensesResult = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${expenses.expenseDate})::integer`,
          expenses: sql<number>`COALESCE(SUM(${expenses.amount}), 0)::integer`
        })
        .from(expenses)
        .where(sql`EXTRACT(YEAR FROM ${expenses.expenseDate}) = ${currentYear}`)
        .groupBy(sql`EXTRACT(MONTH FROM ${expenses.expenseDate})`)
        .orderBy(sql`EXTRACT(MONTH FROM ${expenses.expenseDate})`);

      monthlyExpensesResult.forEach((row) => {
        expensesMap.set(row.month, row.expenses);
      });
    } catch (error) {
      console.log('Monthly expenses query failed, using defaults');
    }

    const monthlyFinancials: MonthlyFinancialItem[] = MONTH_NAMES.map((name, index) => {
      const monthNumber = index + 1;
      const revenue = revenueMap.get(monthNumber) || 0;
      const monthExpenses = expensesMap.get(monthNumber) || 0;
      const profit = revenue - monthExpenses;
      
      return {
        month: name,
        revenue,
        expenses: monthExpenses,
        profit
      };
    });

    // ========================================================================
    // 8. Revenue Growth
    // ========================================================================
    const currentMonthResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .where(
        and(
          sql`EXTRACT(MONTH FROM ${transactions.createdAt}) = ${currentMonth}`,
          sql`EXTRACT(YEAR FROM ${transactions.createdAt}) = ${currentYear}`
        )
      );
    const currentMonthTotal = currentMonthResult[0]?.total || 0;

    const lastMonthResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .where(
        and(
          sql`EXTRACT(MONTH FROM ${transactions.createdAt}) = ${lastMonth}`,
          sql`EXTRACT(YEAR FROM ${transactions.createdAt}) = ${lastMonthYear}`
        )
      );
    const lastMonthTotal = lastMonthResult[0]?.total || 0;

    let revenueGrowth = 0;
    if (lastMonthTotal > 0) {
      revenueGrowth = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    } else if (currentMonthTotal > 0) {
      revenueGrowth = 100;
    }

    return res.status(200).json({
      totalRevenue,
      totalExpenses,
      netProfit,
      todayCollection,
      pendingBalance,
      paymentMethodSplit,
      monthlyFinancials,
      expensesByCategory,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      currentMonthTotal,
      lastMonthTotal
    });

  } catch (error) {
    console.error('Accounting stats error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch accounting stats'
    });
  }
}
