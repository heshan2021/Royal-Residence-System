// pages/api/admin/accounting-stats.ts
// Accounting Statistics API - Owner's Overview
// Uses Drizzle ORM for all aggregate calculations

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, transactions, bookings, expenses } from '../../../src/db';
import { eq, sql, and, gte, lt } from 'drizzle-orm';
import {
  sltCurrentMonth,
  sltCurrentYear,
  sltDayBounds,
  sltMonthBounds,
  sltMonthLabel,
  sltToday,
  sltYearBounds,
} from '../../../lib/hotelDates';

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
  // ---- Period scope (All time / Monthly / Annual toggle) ----
  /** Requested period: 'all' (default) | 'month' | 'year'. */
  period: 'all' | 'month' | 'year';
  /** Human readable scope, e.g. "All time", "October 2026", "2026". */
  periodLabel: string;
  /** Half-open Sri Lankan range start (ISO), or null for all-time. */
  rangeStart: string | null;
  /** Half-open Sri Lankan range end (ISO), or null for all-time. */
  rangeEnd: string | null;
  /**
   * Money taken in for the selected period. For 'all' this is today's
   * collection, so the default view is unchanged.
   */
  collection: number;
  /** Label for `collection`: "Today's Collection" | "This Month's Collection" | "This Year's Collection". */
  collectionLabel: string;
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
    // ========================================================================
    // 0. Period scope
    //    ?period=all                            -> all-time totals (default)
    //    ?period=month&month=<1-12>&year=<yyyy> -> that Sri Lankan month
    //    ?period=year&year=<yyyy>               -> that Sri Lankan year
    //
    //    Every bound below is a Sri Lankan day edge converted to a UTC
    //    instant, because this API may run on a UTC host (Vercel) while the
    //    business day is Asia/Colombo. Transactions are stored as UTC
    //    instants of SLT events, so the same predicate used by the monthly
    //    report applies here.
    // ========================================================================
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period.toLowerCase() : 'all';
    if (rawPeriod !== 'all' && rawPeriod !== 'month' && rawPeriod !== 'year') {
      return res.status(400).json({ error: "Invalid period parameter (expected 'all', 'month' or 'year')" });
    }
    const period = rawPeriod as 'all' | 'month' | 'year';

    const parseNumericParam = (raw: unknown, min: number, max: number): number | null | 'invalid' => {
      if (raw === undefined || raw === '') return null;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 'invalid';
      const parsed = Number(raw);
      return parsed >= min && parsed <= max ? parsed : 'invalid';
    };

    const yearParam = parseNumericParam(req.query.year, 2000, 2100);
    const monthParam = parseNumericParam(req.query.month, 1, 12);
    if (yearParam === 'invalid' || monthParam === 'invalid') {
      return res.status(400).json({ error: 'Invalid month or year parameter' });
    }

    // Anchor is the current Sri Lankan month/year; the caller may override it.
    const anchorYear = sltCurrentYear();
    const anchorMonth = sltCurrentMonth();
    const selectedYear = yearParam ?? anchorYear;
    const selectedMonth = monthParam ?? anchorMonth;

    // Half-open [start, end) window; null means "no date filter" (all time).
    const periodBounds: { start: Date; end: Date } | null =
      period === 'month' ? sltMonthBounds(selectedYear, selectedMonth)
        : period === 'year' ? sltYearBounds(selectedYear)
          : null;

    const rangeWhere = {
      transactions: periodBounds ? and(gte(transactions.createdAt, periodBounds.start), lt(transactions.createdAt, periodBounds.end)) : undefined,
      expenses: periodBounds ? and(gte(expenses.expenseDate, periodBounds.start), lt(expenses.expenseDate, periodBounds.end)) : undefined,
    };

    // Today's Sri Lankan business day (never server-local midnight).
    const todayBounds = sltDayBounds(sltToday());
    const todayWhere = and(
      gte(transactions.createdAt, todayBounds.start),
      lt(transactions.createdAt, todayBounds.end)
    );

    const periodLabel = period === 'month' ? sltMonthLabel(selectedYear, selectedMonth)
      : period === 'year' ? String(selectedYear)
        : 'All time';

    const collectionLabel = period === 'month' ? "This Month's Collection"
      : period === 'year' ? "This Year's Collection"
        : "Today's Collection";

    // Current year/month used by the monthly chart and the growth card.
    // For 'all' these are simply the current Sri Lankan month/year.
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // ========================================================================
    // 1. Total Revenue: SUM of transaction amounts in the selected period
    //    Cash-in only, so this is deliberately already NET of any discount
    //    granted at check-out (a concession lowers what the guest owed, it never
    //    moves money). Discounts given are therefore not deducted here a second
    //    time; they are itemised in the monthly report's DISCOUNT LEDGER.
    // ========================================================================
    const totalRevenueResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .where(rangeWhere.transactions);
    
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // ========================================================================
    // 2. Today's Collection: SUM of today's transaction amounts
    // ========================================================================
    const todayCollectionResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::integer`
      })
      .from(transactions)
      .where(todayWhere);
    
    const todayCollection = todayCollectionResult[0]?.total || 0;

    // Money taken in for the selected period. For 'all' the period is not
    // filtered, so money-in for "all time" is reported as today's collection
    // and the default dashboard stays exactly as it was.
    const collection = periodBounds ? totalRevenue : todayCollection;

    // ========================================================================
    // 3. Pending Balance: Active bookings total - paid transactions
    //    Deliberately NOT period filtered: money still owed is owed now,
    //    whatever scope the owner is browsing.
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
      .where(rangeWhere.transactions)
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
        .from(expenses)
        .where(rangeWhere.expenses);
      
      totalExpenses = totalExpensesResult[0]?.total || 0;

      const expensesByCategoryResult = await db
        .select({
          category: expenses.category,
          total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)::integer`
        })
        .from(expenses)
        .where(rangeWhere.expenses)
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
      lastMonthTotal,
      period,
      periodLabel,
      rangeStart: periodBounds ? periodBounds.start.toISOString() : null,
      rangeEnd: periodBounds ? periodBounds.end.toISOString() : null,
      collection,
      collectionLabel
    });

  } catch (error) {
    console.error('Accounting stats error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch accounting stats'
    });
  }
}
