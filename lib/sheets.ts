/**
 * Google Sheets Integration Module
 * Handles all interactions with Google Sheets
 */

import { google } from 'googleapis';

interface Transaction {
  date: string;
  type: string;
  category: string;
  account1: string;
  account2: string;
  description: string;
  amount: number;
}

function parseAmount(value: string | number): number {
  const strValue = typeof value === 'number' ? value.toString() : value;
  const cleaned = strValue.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

async function getAuthAndSheets() {
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
  }
  
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  return { sheets, spreadsheetId };
}

export async function addTransactionToSheet(transaction: Transaction): Promise<void> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    const values = [[
      transaction.date,
      transaction.type,
      transaction.category,
      transaction.account1,
      transaction.account2,
      transaction.description,
      transaction.amount,
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log('✅ Transaction added to Google Sheets successfully!');
  } catch (error: any) {
    console.error('❌ Google Sheets Error:', error.message);
    throw new Error(`Failed to save transaction to Google Sheets: ${error.message}`);
  }
}

export async function addMultipleTransactions(transactions: Transaction[]): Promise<void> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    const values = transactions.map(t => [
      t.date,
      t.type,
      t.category,
      t.account1,
      t.account2,
      t.description,
      t.amount,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`✅ ${transactions.length} transactions added to Google Sheets successfully!`);
  } catch (error: any) {
    console.error('❌ Google Sheets Error:', error.message);
    throw new Error(`Failed to save transactions to Google Sheets: ${error.message}`);
  }
}

export async function getRecentTransactions(limit: number = 5): Promise<string[][]> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Transactions!A:G',
    });

    const rows = response.data.values || [];
    return rows.slice(-limit);
  } catch (error: any) {
    console.error('❌ Error reading from Google Sheets:', error.message);
    return [];
  }
}

export async function getAllTransactions(): Promise<string[][]> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Transactions!A:G',
    });

    return response.data.values || [];
  } catch (error: any) {
    console.error('❌ Error reading from Google Sheets:', error.message);
    return [];
  }
}

export async function deleteTransactionByRow(rowIndex: number): Promise<void> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    console.log(`🗑️ Attempting to delete row index: ${rowIndex}`);

    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetId = sheetMetadata.data.sheets?.find(
      sheet => sheet.properties?.title === 'Transactions'
    )?.properties?.sheetId || 0;

    console.log(`📊 Sheet ID: ${sheetId}`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    console.log(`✅ Successfully deleted row ${rowIndex} from Google Sheets`);
  } catch (error: any) {
    console.error('❌ Error deleting from Google Sheets:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to delete transaction: ${error.message}`);
  }
}

export async function updateTransaction(
  rowIndex: number,
  field: string,
  value: string | number
): Promise<void> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    const columnMap: { [key: string]: string } = {
      date: 'A',
      type: 'B',
      category: 'C',
      account1: 'D',
      account2: 'E',
      description: 'F',
      amount: 'G',
    };

    const column = columnMap[field];
    if (!column) {
      throw new Error(`Invalid field: ${field}`);
    }

    const range = `Transactions!${column}${rowIndex}`;

    console.log(`📝 Updating ${field} at ${range} to: ${value}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });

    console.log(`✅ Successfully updated ${field} for row ${rowIndex}`);
  } catch (error: any) {
    console.error('❌ Error updating transaction:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to update transaction: ${error.message}`);
  }
}

export async function getLoanCountForAccount(accountName: string): Promise<number> {
  try {
    const allTransactions = await getAllTransactions();
    
    const startingNumbers: { [key: string]: number } = {
      'BPI - Platinum MC': 2,
      'Eastwest - Gold MC': 5,
    };
    
    const startNumber = startingNumbers[accountName] || 1;
    let maxLoanNumber = startNumber - 1;
    
    for (let i = 1; i < allTransactions.length; i++) {
      const row = allTransactions[i];
      if (row.length < 6) continue;
      
      const description = row[5] || '';
      const account1 = row[3] || '';
      
      if (account1 === accountName && description.includes(`${accountName} Loan #`)) {
        const match = description.match(/Loan #(\d+)/);
        if (match) {
          const loanNum = parseInt(match[1], 10);
          if (loanNum > maxLoanNumber) {
            maxLoanNumber = loanNum;
          }
        }
      }
    }
    
    return maxLoanNumber + 1;
  } catch (error: any) {
    console.error('❌ Error getting loan count:', error.message);
    const startingNumbers: { [key: string]: number } = {
      'BPI - Platinum MC': 2,
      'Eastwest - Gold MC': 4,
    };
    return startingNumbers[accountName] || 1;
  }
}

export async function getTransactionsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  try {
    const { sheets, spreadsheetId } = await getAuthAndSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Transactions!A:G',
    });

    const rows = response.data.values || [];
    const transactions: Transaction[] = [];

    console.log(`📊 Filtering transactions from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 7) continue;

      const dateStr = row[0];
      
      let transactionDate: Date;
      
      try {
        transactionDate = new Date(dateStr);
        
        if (isNaN(transactionDate.getTime())) {
          const parts = dateStr.split(/[,\s]+/)[0].split('/');
          if (parts.length === 3) {
            transactionDate = new Date(
              parseInt(parts[2]),
              parseInt(parts[0]) - 1,
              parseInt(parts[1])
            );
          } else {
            console.warn(`⚠️ Could not parse date: ${dateStr}`);
            continue;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing date: ${dateStr}`, error);
        continue;
      }

      if (transactionDate >= startDate && transactionDate <= endDate) {
        const amount = parseAmount(row[6]);
        
        transactions.push({
          date: row[0],
          type: row[1],
          category: row[2],
          account1: row[3],
          account2: row[4],
          description: row[5],
          amount: amount,
        });
      }
    }

    console.log(`✅ Found ${transactions.length} transactions in date range`);

    return transactions;
  } catch (error: any) {
    console.error('❌ Error fetching transactions:', error.message);
    return [];
  }
}

export interface SummaryData {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  incomeByCategory: { [key: string]: number };
  expenseByCategory: { [key: string]: number };
  transactionCount: number;
}

export function calculateSummary(transactions: Transaction[]): SummaryData {
  const summary: SummaryData = {
    totalIncome: 0,
    totalExpense: 0,
    netIncome: 0,
    incomeByCategory: {},
    expenseByCategory: {},
    transactionCount: transactions.length,
  };

  transactions.forEach((transaction) => {
    const amount = typeof transaction.amount === 'number' 
      ? transaction.amount 
      : parseAmount(transaction.amount);

    const absAmount = Math.abs(amount);

    if (transaction.type === 'Income') {
      summary.totalIncome += absAmount;
      summary.incomeByCategory[transaction.category] =
        (summary.incomeByCategory[transaction.category] || 0) + absAmount;
    } else if (transaction.type === 'Expense') {
      if (transaction.category !== 'Reimbursibles') {
        summary.totalExpense += absAmount;
        summary.expenseByCategory[transaction.category] =
          (summary.expenseByCategory[transaction.category] || 0) + absAmount;
      }
    }
  });

  summary.netIncome = summary.totalIncome - summary.totalExpense;

  return summary;
}
