// pages/api/admin/monthly-report.ts
// Monthly Accounting Report API - Generates downloadable CSV
// Includes complete financial data: revenue, expenses, transactions, profit analysis

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, transactions, bookings, guests, rooms, expenses } from '../../../src/db';
import { eq, sql, and, gte, lt, desc } from 'drizzle-orm';

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface TransactionDetail {
  date: string;
  transactionId: number;
  guestName: string;
  guestNic: string;
  roomNumber: string;
  amount: number;
  paymentMethod: string;
  paymentType: string;
}

interface ExpenseDetail {
  date: string;
  category: string;
  description: string | null;
  amount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Parse month and year from query params
    const { month, year } = req.query;
    
    const selectedMonth = parseInt(month as string, 10);
    const selectedYear = parseInt(year as string, 10);
    
    if (isNaN(selectedMonth) || isNaN(selectedYear) || selectedMonth < 1 || selectedMonth > 12) {
      return res.status(400).json({ error: 'Invalid month or year parameter' });
    }

    // Calculate date range for the selected month
    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 1);
    
    const monthName = MONTH_NAMES[selectedMonth - 1];
    const reportPeriod = `${monthName} ${selectedYear}`;
    const generatedAt = new Date().toLocaleString('en-LK', { 
      timeZone: 'Asia/Colombo',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    // ========================================================================
    // 1. FETCH ALL TRANSACTIONS FOR THE MONTH
    // ========================================================================
    const transactionResults = await db
      .select({
        transactionId: transactions.id,
        amount: transactions.amount,
        method: transactions.paymentMethod,
        type: transactions.paymentType,
        date: transactions.createdAt,
        guestName: guests.name,
        guestNic: guests.nicNumber,
        roomNumber: rooms.number,
      })
      .from(transactions)
      .innerJoin(bookings, eq(transactions.bookingId, bookings.id))
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(
        and(
          gte(transactions.createdAt, startDate),
          lt(transactions.createdAt, endDate)
        )
      )
      .orderBy(desc(transactions.createdAt));

    // ========================================================================
    // 2. FETCH ALL EXPENSES FOR THE MONTH
    // ========================================================================
    let expenseResults: ExpenseDetail[] = [];
    try {
      const expenseData = await db
        .select()
        .from(expenses)
        .where(
          and(
            gte(expenses.expenseDate, startDate),
            lt(expenses.expenseDate, endDate)
          )
        )
        .orderBy(desc(expenses.expenseDate));

      expenseResults = expenseData.map(exp => ({
        date: exp.expenseDate?.toISOString().split('T')[0] || '',
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
      }));
    } catch (error) {
      console.log('Expenses table not available:', error);
    }

    // ========================================================================
    // 3. CALCULATE REVENUE BREAKDOWN
    // ========================================================================
    let totalCashRevenue = 0;
    let totalBankRevenue = 0;
    let advancePayments = 0;
    let finalSettlements = 0;
    let highestPayment = 0;
    let lowestPayment = Infinity;

    const transactionDetails: TransactionDetail[] = transactionResults.map(tx => {
      const amount = tx.amount;
      
      // Revenue by payment method
      if (tx.method === 'Cash') {
        totalCashRevenue += amount;
      } else if (tx.method === 'Bank') {
        totalBankRevenue += amount;
      }

      // Revenue by payment type
      if (tx.type === 'advance') {
        advancePayments += amount;
      } else {
        finalSettlements += amount;
      }

      // Track highest/lowest
      if (amount > highestPayment) highestPayment = amount;
      if (amount < lowestPayment) lowestPayment = amount;

      return {
        date: tx.date?.toISOString().split('T')[0] || '',
        transactionId: tx.transactionId,
        guestName: tx.guestName,
        guestNic: tx.guestNic,
        roomNumber: tx.roomNumber,
        amount,
        paymentMethod: tx.method,
        paymentType: tx.type === 'advance' ? 'Advance Payment' : 'Final Settlement',
      };
    });

    if (transactionDetails.length === 0) {
      lowestPayment = 0;
    }

    const totalRevenue = totalCashRevenue + totalBankRevenue;
    const avgTransaction = transactionDetails.length > 0 
      ? Math.round(totalRevenue / transactionDetails.length) 
      : 0;

    // ========================================================================
    // 4. CALCULATE EXPENSE BREAKDOWN BY CATEGORY
    // ========================================================================
    const expensesByCategory: Record<string, number> = {
      'Marketing': 0,
      'Maintenance': 0,
      'Guest Supplies': 0,
      'Utilities': 0,
      'Other': 0,
    };

    let totalExpenses = 0;
    expenseResults.forEach(exp => {
      totalExpenses += exp.amount;
      if (expensesByCategory.hasOwnProperty(exp.category)) {
        expensesByCategory[exp.category] += exp.amount;
      }
    });

    // ========================================================================
    // 5. CALCULATE NET PROFIT/LOSS
    // ========================================================================
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 
      ? ((netProfit / totalRevenue) * 100).toFixed(2) 
      : '0.00';

    // ========================================================================
    // 6. GENERATE CSV CONTENT
    // ========================================================================
    const csvLines: string[] = [];

    // Header
    csvLines.push('ROYAL RESIDENCE - MONTHLY ACCOUNTING REPORT');
    csvLines.push(`"Period: ${reportPeriod}"`);
    csvLines.push(`"Generated: ${generatedAt}"`);
    csvLines.push('');
    csvLines.push('================================================================================');
    
    // INCOME STATEMENT SECTION
    csvLines.push('');
    csvLines.push('INCOME STATEMENT');
    csvLines.push('================================================================================');
    csvLines.push('');
    csvLines.push('REVENUE');
    csvLines.push('--------------------------------------------------------------------------------');
    csvLines.push(`"Room Revenue (Cash)","LKR ${totalCashRevenue.toLocaleString()}"`);
    csvLines.push(`"Room Revenue (Bank Transfer)","LKR ${totalBankRevenue.toLocaleString()}"`);
    csvLines.push('--------------------------------------------------------------------------------');
    csvLines.push(`"TOTAL REVENUE","LKR ${totalRevenue.toLocaleString()}"`);
    csvLines.push('');
    
    csvLines.push('REVENUE BY PAYMENT TYPE');
    csvLines.push('--------------------------------------------------------------------------------');
    csvLines.push(`"Advance Payments Received","LKR ${advancePayments.toLocaleString()}"`);
    csvLines.push(`"Final Settlements Received","LKR ${finalSettlements.toLocaleString()}"`);
    csvLines.push('');
    
    csvLines.push('OPERATING EXPENSES');
    csvLines.push('--------------------------------------------------------------------------------');
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      csvLines.push(`"${category}","LKR ${amount.toLocaleString()}"`);
    });
    csvLines.push('--------------------------------------------------------------------------------');
    csvLines.push(`"TOTAL OPERATING EXPENSES","LKR ${totalExpenses.toLocaleString()}"`);
    csvLines.push('');
    
    csvLines.push('================================================================================');
    csvLines.push('PROFIT & LOSS SUMMARY');
    csvLines.push('================================================================================');
    csvLines.push(`"Gross Revenue","LKR ${totalRevenue.toLocaleString()}"`);
    csvLines.push(`"Less: Operating Expenses","LKR ${totalExpenses.toLocaleString()}"`);
    csvLines.push('--------------------------------------------------------------------------------');
    csvLines.push(`"NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}","LKR ${Math.abs(netProfit).toLocaleString()}"`);
    csvLines.push(`"Profit Margin","${profitMargin}%"`);
    csvLines.push('');
    
    // STATISTICS SECTION
    csvLines.push('================================================================================');
    csvLines.push('TRANSACTION STATISTICS');
    csvLines.push('================================================================================');
    csvLines.push(`"Total Number of Transactions","${transactionDetails.length}"`);
    csvLines.push(`"Cash Transactions","${transactionDetails.filter(t => t.paymentMethod === 'Cash').length}"`);
    csvLines.push(`"Bank Transfer Transactions","${transactionDetails.filter(t => t.paymentMethod === 'Bank').length}"`);
    csvLines.push(`"Average Transaction Value","LKR ${avgTransaction.toLocaleString()}"`);
    csvLines.push(`"Highest Single Payment","LKR ${highestPayment.toLocaleString()}"`);
    csvLines.push(`"Lowest Single Payment","LKR ${lowestPayment.toLocaleString()}"`);
    csvLines.push('');
    csvLines.push(`"Total Number of Expenses","${expenseResults.length}"`);
    csvLines.push('');
    
    // DETAILED TRANSACTIONS SECTION
    csvLines.push('================================================================================');
    csvLines.push('DETAILED TRANSACTION LEDGER');
    csvLines.push('================================================================================');
    csvLines.push('Date,Transaction ID,Guest Name,NIC Number,Room Number,Amount (LKR),Payment Method,Payment Type');
    
    if (transactionDetails.length === 0) {
      csvLines.push('"No transactions recorded for this period"');
    } else {
      transactionDetails.forEach(tx => {
        csvLines.push(
          `"${tx.date}","${tx.transactionId}","${tx.guestName}","${tx.guestNic}","${tx.roomNumber}","${tx.amount.toLocaleString()}","${tx.paymentMethod}","${tx.paymentType}"`
        );
      });
    }
    csvLines.push('');
    
    // DETAILED EXPENSES SECTION
    csvLines.push('================================================================================');
    csvLines.push('DETAILED EXPENSE LEDGER');
    csvLines.push('================================================================================');
    csvLines.push('Date,Category,Description,Amount (LKR)');
    
    if (expenseResults.length === 0) {
      csvLines.push('"No expenses recorded for this period"');
    } else {
      expenseResults.forEach(exp => {
        const description = exp.description ? exp.description.replace(/"/g, '""') : 'N/A';
        csvLines.push(
          `"${exp.date}","${exp.category}","${description}","${exp.amount.toLocaleString()}"`
        );
      });
    }
    csvLines.push('');
    
    // FOOTER
    csvLines.push('================================================================================');
    csvLines.push('END OF REPORT');
    csvLines.push('================================================================================');
    csvLines.push('');
    csvLines.push('"This report was auto-generated by Royal Residence Accounting System"');
    csvLines.push(`"Report covers the full calendar month of ${reportPeriod}"`);

    // Join all lines with Windows-style line endings for better Excel compatibility
    const csvContent = csvLines.join('\r\n');

    // Set headers for CSV download
    const filename = `Royal_Residence_Accounting_${monthName}_${selectedYear}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error('Monthly report error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate monthly report'
    });
  }
}
