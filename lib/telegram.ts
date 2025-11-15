/**
 * Telegram Bot Utilities
 * Helper functions for creating bot responses and keyboards
 */

export const TRANSACTION_TYPES = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  TRANSFER: 'Transfer',
  REIMBURSEMENT: 'Reimbursement',
  LOAN: 'Loan',
};

export const CATEGORIES = {
  INCOME: ['Salary', 'Interest income', 'Investment income', 'Affiliate income'],
  EXPENSE: ['Food', 'Fastfood', 'Hygiene', 'Bills', 'Gym', 'Motorcycle', 'MExp', 'Cats', 'Investment', 'Interest expense', 'Reimbursibles', 'Other expenses'],
  REIMBURSEMENT: ['Reimbursibles'],
  TRANSFER: [],
  LOAN: [],
};

export const ACCOUNTS = [
  'Cash',
  'Maribank',
  'BDO',
  'BPI',
  'Gcash',
  'Maya',
  'Savings - eC-Savings',
  'EF – UnoDigital',
  'BPI - Platinum MC',
  'Eastwest - Gold MC',
  'Unionbank - Platinum Visa',
  'Settle Up',
  'Receivable',
  'Loan - clearing',
];

export function createMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '💸 Add Expense' }, { text: '💰 Add Income' }],
      [{ text: '🔄 Add Transfer' }, { text: '💳 Add Reimbursement' }],
      [{ text: '🤝 Add Receivable' }, { text: '💵 Add Payable' }],
      [{ text: '📊 View Recent' }, { text: '📈 Financial Summary' }],
      [{ text: '🗑️ Delete Transaction' }, { text: '📝 Edit Transaction' }],
      [{ text: '❌ Cancel' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function createReceivableTypeKeyboard() {
  return {
    keyboard: [
      [{ text: '➕ New Receivable' }],
      [{ text: '💰 Payment Received' }],
      [{ text: '🔙 Back' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createSummaryTypeKeyboard() {
  return {
    keyboard: [
      [{ text: '📅 Monthly Summary' }],
      [{ text: '📆 Yearly Summary' }],
      [{ text: '🔙 Back to Menu' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createYearSelectionKeyboard() {
  const currentYear = new Date().getFullYear();
  return {
    keyboard: [
      [{ text: `📅 ${currentYear}` }],
      [{ text: `📅 ${currentYear - 1}` }],
      [{ text: `📅 ${currentYear - 2}` }],
      [{ text: '🔙 Back' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createMonthSelectionKeyboard() {
  return {
    keyboard: [
      [{ text: '📅 January' }, { text: '📅 February' }, { text: '📅 March' }],
      [{ text: '📅 April' }, { text: '📅 May' }, { text: '📅 June' }],
      [{ text: '📅 July' }, { text: '📅 August' }, { text: '📅 September' }],
      [{ text: '📅 October' }, { text: '📅 November' }, { text: '📅 December' }],
      [{ text: '🔙 Back' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createCategoryKeyboard(type: string) {
  const categories = CATEGORIES[type as keyof typeof CATEGORIES] || [];
  const keyboard = [];
  
  for (let i = 0; i < categories.length; i += 2) {
    const row = [{ text: categories[i] }];
    if (categories[i + 1]) {
      row.push({ text: categories[i + 1] });
    }
    keyboard.push(row);
  }
  
  keyboard.push([{ text: '🔙 Back' }]);
  
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createAccountKeyboard() {
  const keyboard = [];
  
  for (let i = 0; i < ACCOUNTS.length; i += 2) {
    const row = [{ text: ACCOUNTS[i] }];
    if (ACCOUNTS[i + 1]) {
      row.push({ text: ACCOUNTS[i + 1] });
    }
    keyboard.push(row);
  }
  
  keyboard.push([{ text: '🔙 Back' }]);
  
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createEditFieldKeyboard() {
  return {
    keyboard: [
      [{ text: '📅 Edit Date' }, { text: '📊 Edit Type' }],
      [{ text: '📁 Edit Category' }, { text: '💳 Edit Account 1' }],
      [{ text: '💳 Edit Account 2' }, { text: '📝 Edit Description' }],
      [{ text: '💰 Edit Amount' }],
      [{ text: '🔙 Back to Menu' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function createTypeKeyboard() {
  return {
    keyboard: [
      [{ text: 'Expense' }, { text: 'Income' }],
      [{ text: 'Transfer' }, { text: 'Reimbursement' }],
      [{ text: 'Loan' }],
      [{ text: '🔙 Back' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function parseAmount(value: string | number): number {
  const strValue = typeof value === 'number' ? value.toString() : value;
  const cleaned = strValue.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrency(amount: number | string): string {
  const numericAmount = typeof amount === 'string' ? parseAmount(amount) : amount;
  const displayAmount = Math.abs(numericAmount);
  
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(displayAmount);
}

export function getCurrentDateTime(): string {
  return new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getMonthDateRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(year, month + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export function getYearDateRange(year: number): { start: Date; end: Date } {
  const start = new Date(year, 0, 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(year, 11, 31);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export function parseMonthFromText(text: string): number {
  const months: { [key: string]: number } = {
    'January': 0,
    'February': 1,
    'March': 2,
    'April': 3,
    'May': 4,
    'June': 5,
    'July': 6,
    'August': 7,
    'September': 8,
    'October': 9,
    'November': 10,
    'December': 11,
  };
  
  const monthName = text.replace('📅 ', '');
  return months[monthName] ?? -1;
}

export function parseYearFromText(text: string): number {
  const yearStr = text.replace('📅 ', '');
  return parseInt(yearStr, 10);
}
