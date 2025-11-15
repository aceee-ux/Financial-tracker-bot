/**
 * Telegram Webhook Handler - Complete with Enhanced Edit Transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedUser, getUnauthorizedMessage } from '../../lib/auth';
import { 
  addTransactionToSheet,
  addMultipleTransactions,
  getRecentTransactions,
  getAllTransactions,
  deleteTransactionByRow,
  updateTransaction,
  getTransactionsByDateRange,
  calculateSummary,
  getLoanCountForAccount
} from '../../lib/sheets';
import {
  TRANSACTION_TYPES,
  CATEGORIES,
  ACCOUNTS,
  createMainMenuKeyboard,
  createCategoryKeyboard,
  createAccountKeyboard,
  createReceivableTypeKeyboard,
  createSummaryTypeKeyboard,
  createYearSelectionKeyboard,
  createMonthSelectionKeyboard,
  createEditFieldKeyboard,
  createTypeKeyboard,
  formatCurrency,
  parseAmount,
  getCurrentDateTime,
  getMonthDateRange,
  getYearDateRange,
  parseMonthFromText,
  parseYearFromText,
} from '../../lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const userSessions = new Map<number, any>();

async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: any
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
      parse_mode: 'HTML',
    }),
  });
}

function getSession(userId: number) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { step: 'idle', data: {}, history: [] });
  }
  return userSessions.get(userId);
}

function resetSession(userId: number) {
  userSessions.set(userId, { step: 'idle', data: {}, history: [] });
}

function goBackToPreviousStep(session: any) {
  if (session.history.length > 0) {
    const previousState = session.history.pop();
    session.step = previousState.step;
    session.data = { ...previousState.data };
    return true;
  }
  return false;
}

function saveCurrentState(session: any) {
  session.history.push({
    step: session.step,
    data: { ...session.data }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('✅ Webhook received');
    
    if (!body.message) {
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    console.log(`📨 Message from user ${userId}: "${text}"`);

    if (!isAuthorizedUser(userId)) {
      console.log(`🚫 Unauthorized user ${userId}`);
      await sendTelegramMessage(chatId, getUnauthorizedMessage());
      return NextResponse.json({ ok: true });
    }

    const session = getSession(userId);

    if (text === '/start') {
      resetSession(userId);
      await sendTelegramMessage(
        chatId,
        '👋 Welcome to your Personal Finance Tracker!\n\nChoose an option:',
        createMainMenuKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '❌ Cancel') {
      resetSession(userId);
      await sendTelegramMessage(chatId, '✅ Cancelled.', createMainMenuKeyboard());
      return NextResponse.json({ ok: true });
    }

    if (text === '🔙 Back to Menu') {
      resetSession(userId);
      await sendTelegramMessage(chatId, '🏠 Main menu:', createMainMenuKeyboard());
      return NextResponse.json({ ok: true });
    }

    if (text === '🔙 Back') {
      const wentBack = goBackToPreviousStep(session);
      
      if (!wentBack) {
        resetSession(userId);
        await sendTelegramMessage(chatId, '🏠 Main menu:', createMainMenuKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (session.step === 'category') {
        const typeKey = session.data.type === TRANSACTION_TYPES.EXPENSE ? 'EXPENSE' : 'INCOME';
        await sendTelegramMessage(
          chatId,
          `Select category:`,
          createCategoryKeyboard(typeKey)
        );
      } else if (session.step === 'account1' || session.step === 'account2') {
        await sendTelegramMessage(
          chatId,
          `Select account:`,
          createAccountKeyboard()
        );
      } else if (session.step === 'description') {
        await sendTelegramMessage(
          chatId,
          `Enter description:`,
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      }
      
      return NextResponse.json({ ok: true });
    }

    if (text === '💵 Add Payable') {
      saveCurrentState(session);
      session.step = 'payable_description';
      session.data = {};
      await sendTelegramMessage(
        chatId,
        '💵 <b>Add Payable - Loan Proceeds</b>\n\n📝 Enter loan description:',
        { 
          keyboard: [[{ text: '🔙 Back to Menu' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_description') {
      saveCurrentState(session);
      session.data.loanDescription = text;
      session.step = 'payable_proceeds_amount';
      await sendTelegramMessage(
        chatId,
        `✅ Description: <b>${text}</b>\n\n💵 Enter loan proceeds amount:`,
        { 
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_proceeds_amount') {
      const amount = parseAmount(text);
      
      if (isNaN(amount) || amount <= 0) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount. Enter a valid number:',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      saveCurrentState(session);
      session.data.proceedsAmount = amount;
      session.step = 'payable_account';
      await sendTelegramMessage(
        chatId,
        `✅ Amount: ${formatCurrency(amount)}\n\n💳 Select the account for monthly payments (Account #1):`,
        createAccountKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_account') {
      if (ACCOUNTS.includes(text)) {
        saveCurrentState(session);
        session.data.paymentAccount = text;
        session.step = 'payable_billing_date';
        await sendTelegramMessage(
          chatId,
          `✅ Account: <b>${text}</b>\n\n📅 Enter first billing date (MM/DD/YYYY):\n\nExample: 12/15/2024`,
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_billing_date') {
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      
      if (!dateRegex.test(text)) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid date format. Use MM/DD/YYYY\n\nExample: 12/15/2024',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      saveCurrentState(session);
      session.data.firstBillingDate = text;
      session.step = 'payable_terms';
      await sendTelegramMessage(
        chatId,
        `✅ First billing: <b>${text}</b>\n\n📊 Enter loan terms (number of months):\n\nExample: 12`,
        { 
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_terms') {
      const terms = parseInt(text);
      
      if (isNaN(terms) || terms <= 0 || terms > 360) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid number. Enter months (1-360):',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      saveCurrentState(session);
      session.data.loanTerms = terms;
      session.step = 'payable_principal';
      await sendTelegramMessage(
        chatId,
        `✅ Terms: <b>${terms} months</b>\n\n💰 Enter monthly principal payment:`,
        { 
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_principal') {
      const principal = parseAmount(text);
      
      if (isNaN(principal) || principal <= 0) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount. Enter monthly principal:',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      saveCurrentState(session);
      session.data.monthlyPrincipal = principal;
      session.step = 'payable_interest';
      await sendTelegramMessage(
        chatId,
        `✅ Monthly principal: ${formatCurrency(principal)}\n\n💸 Enter monthly interest payment:`,
        { 
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_interest') {
      const interest = parseAmount(text);
      
      if (isNaN(interest) || interest < 0) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount. Enter monthly interest (or 0):',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      saveCurrentState(session);
      session.data.monthlyInterest = interest;
      session.step = 'payable_processing_fee';
      await sendTelegramMessage(
        chatId,
        `✅ Monthly interest: ${formatCurrency(interest)}\n\n💳 Enter processing fee (or 0 if none):`,
        { 
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'payable_processing_fee') {
      const processingFee = parseAmount(text);
      
      if (isNaN(processingFee) || processingFee < 0) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount. Enter processing fee (or 0):',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      try {
        const currentDate = getCurrentDateTime();
        const account = session.data.paymentAccount;
        const loanNumber = await getLoanCountForAccount(account);
        
        const transactions = [];

        transactions.push({
          date: currentDate,
          type: 'Loan',
          category: '',
          account1: '',
          account2: 'Loan - clearing',
          description: session.data.loanDescription,
          amount: session.data.proceedsAmount,
        });

        transactions.push({
          date: currentDate,
          type: 'Transfer',
          category: '',
          account1: 'Loan - clearing',
          account2: 'Maribank',
          description: 'Loan proceeds transfer only',
          amount: session.data.proceedsAmount,
        });

        const billingDate = new Date(session.data.firstBillingDate);
        
        for (let i = 0; i < session.data.loanTerms; i++) {
          const paymentDate = new Date(billingDate);
          paymentDate.setMonth(paymentDate.getMonth() + i);
          const formattedDate = paymentDate.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
          });

          transactions.push({
            date: formattedDate,
            type: 'Expense',
            category: '',
            account1: account,
            account2: '',
            description: `${account} Loan #${loanNumber} - Principal #${i + 1}`,
            amount: -session.data.monthlyPrincipal,
          });

          transactions.push({
            date: formattedDate,
            type: 'Expense',
            category: 'Interest expense',
            account1: account,
            account2: '',
            description: `${account} Loan #${loanNumber} - Interest #${i + 1}`,
            amount: -session.data.monthlyInterest,
          });
        }

        if (processingFee > 0) {
          transactions.push({
            date: session.data.firstBillingDate,
            type: 'Expense',
            category: 'Interest expense',
            account1: account,
            account2: '',
            description: `${account} Loan #${loanNumber} - Processing fee`,
            amount: -processingFee,
          });
        }

        await addMultipleTransactions(transactions);

        let summary = `✅ <b>Loan Created Successfully!</b>\n\n`;
        summary += `📋 Loan #${loanNumber} for ${account}\n`;
        summary += `💰 Proceeds: ${formatCurrency(session.data.proceedsAmount)}\n`;
        summary += `📅 First billing: ${session.data.firstBillingDate}\n`;
        summary += `📊 Terms: ${session.data.loanTerms} months\n`;
        summary += `💵 Monthly principal: ${formatCurrency(session.data.monthlyPrincipal)}\n`;
        summary += `💸 Monthly interest: ${formatCurrency(session.data.monthlyInterest)}\n`;
        if (processingFee > 0) {
          summary += `💳 Processing fee: ${formatCurrency(processingFee)}\n`;
        }
        summary += `\n📝 Total transactions created: ${transactions.length}`;

        resetSession(userId);
        
        await sendTelegramMessage(chatId, summary, createMainMenuKeyboard());
      } catch (error) {
        console.error('❌ Error creating loan:', error);
        await sendTelegramMessage(
          chatId,
          '❌ Error creating loan. Please try again.',
          createMainMenuKeyboard()
        );
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (text === '🤝 Add Receivable') {
      saveCurrentState(session);
      session.step = 'receivable_type';
      session.data = { type: TRANSACTION_TYPES.TRANSFER, category: '' };
      await sendTelegramMessage(
        chatId,
        '🤝 <b>Add Receivable</b>\n\nIs this new or payment?',
        createReceivableTypeKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '➕ New Receivable' && session.step === 'receivable_type') {
      saveCurrentState(session);
      session.data.receivableType = 'new';
      session.step = 'receivable_account';
      await sendTelegramMessage(
        chatId,
        '🤝 <b>New Receivable</b>\n\nSelect account (Account #1):',
        createAccountKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '💰 Payment Received' && session.step === 'receivable_type') {
      saveCurrentState(session);
      session.data.receivableType = 'payment';
      session.data.account1 = 'Receivable';
      session.step = 'receivable_account';
      await sendTelegramMessage(
        chatId,
        '💰 <b>Payment Received</b>\n\nSelect account (Account #2):',
        createAccountKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'receivable_account') {
      if (ACCOUNTS.includes(text)) {
        saveCurrentState(session);
        
        if (session.data.receivableType === 'new') {
          session.data.account1 = text;
          session.data.account2 = 'Receivable';
        } else {
          session.data.account2 = text;
        }
        
        session.step = 'receivable_description';
        await sendTelegramMessage(
          chatId,
          `✅ Account: <b>${text}</b>\n\n📝 Enter description:`,
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'receivable_description') {
      saveCurrentState(session);
      session.data.description = text;
      session.step = 'receivable_amount';
      await sendTelegramMessage(
        chatId,
        `✅ Description: <b>${text}</b>\n\n💵 Enter amount:`,
        { 
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'receivable_amount') {
      const amount = parseAmount(text);
      
      if (isNaN(amount) || amount <= 0) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount. Enter a valid number:',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      try {
        await addTransactionToSheet({
          date: getCurrentDateTime(),
          type: session.data.type,
          category: session.data.category,
          account1: session.data.account1,
          account2: session.data.account2,
          description: session.data.description,
          amount,
        });

        let summary = `✅ <b>${session.data.receivableType === 'new' ? 'New Receivable' : 'Payment Received'} Saved!</b>\n\n`;
        summary += `📊 Type: Transfer\n`;
        summary += `💳 ${session.data.account1} → ${session.data.account2}\n`;
        summary += `📝 Description: ${session.data.description}\n`;
        summary += `💰 Amount: ${formatCurrency(amount)}\n`;

        resetSession(userId);
        
        await sendTelegramMessage(chatId, summary, createMainMenuKeyboard());
      } catch (error) {
        console.error('❌ Error saving receivable:', error);
        await sendTelegramMessage(
          chatId,
          '❌ Error saving. Try again.',
          createMainMenuKeyboard()
        );
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (text === '🗑️ Delete Transaction') {
      const allTransactions = await getAllTransactions();
      
      if (allTransactions.length <= 1) {
        await sendTelegramMessage(
          chatId,
          '📊 No transactions to delete.',
          createMainMenuKeyboard()
        );
        return NextResponse.json({ ok: true });
      }

      const recentTransactions = allTransactions.slice(-10);
      let message = '🗑️ <b>Delete Transaction</b>\n\nSelect number to delete:\n\n';

      const keyboard = [];
      
      recentTransactions.forEach((row, index) => {
        if (index === 0 && row[0] === 'Date') return;
        
        const actualIndex = allTransactions.length - (recentTransactions.length - index);
        message += `<b>${index + 1}.</b> ${row[1]} - ${formatCurrency(row[6])}\n`;
        message += `   📅 ${row[0]}\n`;
        message += `   📝 ${row[5]}\n\n`;
        
        keyboard.push([{ text: `${index + 1}` }]);
      });

      keyboard.push([{ text: '🔙 Back to Menu' }]);

      session.step = 'delete_select';
      session.data = { transactions: recentTransactions, allCount: allTransactions.length };
      
      await sendTelegramMessage(chatId, message, {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: true,
      });
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'delete_select') {
      const selection = parseInt(text);
      
      if (isNaN(selection) || selection < 1 || selection > session.data.transactions.length) {
        await sendTelegramMessage(chatId, '❌ Invalid selection.', createMainMenuKeyboard());
        resetSession(userId);
        return NextResponse.json({ ok: true });
      }

      const transactionIndex = session.data.allCount - (session.data.transactions.length - selection);
      const selectedTransaction = session.data.transactions[selection - 1];

      try {
        await deleteTransactionByRow(transactionIndex);

        let summary = `✅ <b>Transaction Deleted!</b>\n\n`;
        summary += `📊 Type: ${selectedTransaction[1]}\n`;
        summary += `📅 Date: ${selectedTransaction[0]}\n`;
        summary += `📝 Description: ${selectedTransaction[5]}\n`;
        summary += `💰 Amount: ${formatCurrency(selectedTransaction[6])}\n`;

        resetSession(userId);
        
        await sendTelegramMessage(chatId, summary, createMainMenuKeyboard());
      } catch (error) {
        console.error('❌ Error deleting:', error);
        await sendTelegramMessage(chatId, '❌ Error deleting.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (text === '📝 Edit Transaction') {
      const allTransactions = await getAllTransactions();
      
      if (allTransactions.length <= 1) {
        await sendTelegramMessage(chatId, '📊 No transactions to edit.', createMainMenuKeyboard());
        return NextResponse.json({ ok: true });
      }

      const recentTransactions = allTransactions.slice(-10);
      let message = '📝 <b>Edit Transaction</b>\n\nSelect transaction:\n\n';

      const keyboard = [];
      
      recentTransactions.forEach((row, index) => {
        if (index === 0 && row[0] === 'Date') return;
        
        const actualIndex = allTransactions.length - (recentTransactions.length - index);
        message += `<b>${index + 1}.</b> ${row[1]} - ${formatCurrency(row[6])}\n`;
        message += `   📅 ${row[0]}\n`;
        message += `   📝 ${row[5]}\n\n`;
        
        keyboard.push([{ text: `${index + 1}` }]);
      });

      keyboard.push([{ text: '🔙 Back to Menu' }]);

      session.step = 'edit_select';
      session.data = { transactions: recentTransactions, allCount: allTransactions.length };
      
      await sendTelegramMessage(chatId, message, {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: true,
      });
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_select') {
      const selection = parseInt(text);
      
      if (isNaN(selection) || selection < 1 || selection > session.data.transactions.length) {
        await sendTelegramMessage(chatId, '❌ Invalid selection.', createMainMenuKeyboard());
        resetSession(userId);
        return NextResponse.json({ ok: true });
      }

      const transactionIndex = session.data.allCount - (session.data.transactions.length - selection);
      const selectedTransaction = session.data.transactions[selection - 1];

      session.step = 'edit_field_select';
      session.data.selectedIndex = transactionIndex;
      session.data.selectedTransaction = selectedTransaction;

      let message = `📝 <b>Edit Transaction</b>\n\n`;
      message += `📅 Date: ${selectedTransaction[0]}\n`;
      message += `📊 Type: ${selectedTransaction[1]}\n`;
      message += `📁 Category: ${selectedTransaction[2] || 'None'}\n`;
      message += `💳 Account 1: ${selectedTransaction[3] || 'None'}\n`;
      message += `💳 Account 2: ${selectedTransaction[4] || 'None'}\n`;
      message += `📝 Description: ${selectedTransaction[5]}\n`;
      message += `💰 Amount: ${formatCurrency(selectedTransaction[6])}\n\n`;
      message += `Select field to edit:`;

      await sendTelegramMessage(chatId, message, createEditFieldKeyboard());
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_field_select') {
      if (text === '📅 Edit Date') {
        session.step = 'edit_date_input';
        await sendTelegramMessage(
          chatId,
          `📅 <b>Edit Date</b>\n\nCurrent: ${session.data.selectedTransaction[0]}\n\nEnter new date (MM/DD/YYYY):`,
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      } else if (text === '📊 Edit Type') {
        session.step = 'edit_type_input';
        await sendTelegramMessage(
          chatId,
          `📊 <b>Edit Type</b>\n\nCurrent: ${session.data.selectedTransaction[1]}\n\nSelect new type:`,
          createTypeKeyboard()
        );
      } else if (text === '📁 Edit Category') {
        session.step = 'edit_category_input';
        const currentType = session.data.selectedTransaction[1];
        const categoryType = currentType === 'Income' ? 'INCOME' : 'EXPENSE';
        await sendTelegramMessage(
          chatId,
          `📁 <b>Edit Category</b>\n\nCurrent: ${session.data.selectedTransaction[2] || 'None'}\n\nSelect new category:`,
          createCategoryKeyboard(categoryType)
        );
      } else if (text === '💳 Edit Account 1') {
        session.step = 'edit_account1_input';
        await sendTelegramMessage(
          chatId,
          `💳 <b>Edit Account 1</b>\n\nCurrent: ${session.data.selectedTransaction[3] || 'None'}\n\nSelect new account:`,
          createAccountKeyboard()
        );
      } else if (text === '💳 Edit Account 2') {
        session.step = 'edit_account2_input';
        await sendTelegramMessage(
          chatId,
          `💳 <b>Edit Account 2</b>\n\nCurrent: ${session.data.selectedTransaction[4] || 'None'}\n\nSelect new account:`,
          createAccountKeyboard()
        );
      } else if (text === '📝 Edit Description') {
        session.step = 'edit_description_input';
        await sendTelegramMessage(
          chatId,
          `📝 <b>Edit Description</b>\n\nCurrent: ${session.data.selectedTransaction[5]}\n\nEnter new description:`,
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      } else if (text === '💰 Edit Amount') {
        session.step = 'edit_amount_input';
        await sendTelegramMessage(
          chatId,
          `💰 <b>Edit Amount</b>\n\nCurrent: ${formatCurrency(session.data.selectedTransaction[6])}\n\nEnter new amount:`,
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_date_input') {
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      
      if (!dateRegex.test(text)) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid format. Use MM/DD/YYYY',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      try {
        await updateTransaction(session.data.selectedIndex, 'date', text);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Date Updated!</b>\n\nOld: ${session.data.selectedTransaction[0]}\nNew: ${text}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_type_input') {
      const validTypes = ['Expense', 'Income', 'Transfer', 'Reimbursement', 'Loan'];
      
      if (!validTypes.includes(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid type.', createTypeKeyboard());
        return NextResponse.json({ ok: true });
      }

      try {
        await updateTransaction(session.data.selectedIndex, 'type', text);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Type Updated!</b>\n\nOld: ${session.data.selectedTransaction[1]}\nNew: ${text}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_category_input') {
      const allCategories = [...CATEGORIES.INCOME, ...CATEGORIES.EXPENSE, ...CATEGORIES.REIMBURSEMENT];
      
      if (!allCategories.includes(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid category.', createMainMenuKeyboard());
        resetSession(userId);
        return NextResponse.json({ ok: true });
      }

      try {
        await updateTransaction(session.data.selectedIndex, 'category', text);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Category Updated!</b>\n\nOld: ${session.data.selectedTransaction[2]}\nNew: ${text}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_account1_input') {
      if (!ACCOUNTS.includes(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid account.', createAccountKeyboard());
        return NextResponse.json({ ok: true });
      }

      try {
        await updateTransaction(session.data.selectedIndex, 'account1', text);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Account 1 Updated!</b>\n\nOld: ${session.data.selectedTransaction[3]}\nNew: ${text}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_account2_input') {
      if (!ACCOUNTS.includes(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid account.', createAccountKeyboard());
        return NextResponse.json({ ok: true });
      }

      try {
        await updateTransaction(session.data.selectedIndex, 'account2', text);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Account 2 Updated!</b>\n\nOld: ${session.data.selectedTransaction[4]}\nNew: ${text}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_description_input') {
      try {
        await updateTransaction(session.data.selectedIndex, 'description', text);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Description Updated!</b>\n\nOld: ${session.data.selectedTransaction[5]}\nNew: ${text}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'edit_amount_input') {
      let amount = parseAmount(text);
      
      if (isNaN(amount)) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount.',
          { 
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      // Check if the transaction type is Expense, then make amount negative
      const transactionType = session.data.selectedTransaction[1];
      if (transactionType === 'Expense') {
        amount = -Math.abs(amount);
      }

      try {
        await updateTransaction(session.data.selectedIndex, 'amount', amount);
        await sendTelegramMessage(
          chatId,
          `✅ <b>Amount Updated!</b>\n\nOld: ${formatCurrency(session.data.selectedTransaction[6])}\nNew: ${formatCurrency(amount)}`,
          createMainMenuKeyboard()
        );
        resetSession(userId);
      } catch (error) {
        console.error('❌ Error updating:', error);
        await sendTelegramMessage(chatId, '❌ Error updating.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    if (text === '📈 Financial Summary') {
      saveCurrentState(session);
      session.step = 'summary_select_type';
      session.data = {};
      await sendTelegramMessage(
        chatId,
        '📊 <b>Financial Summary</b>\n\nChoose type:',
        createSummaryTypeKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '📅 Monthly Summary' && session.step === 'summary_select_type') {
      saveCurrentState(session);
      session.data.summaryType = 'monthly';
      session.step = 'summary_select_year';
      await sendTelegramMessage(
        chatId,
        '📅 <b>Monthly Summary</b>\n\nSelect year:',
        createYearSelectionKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '📆 Yearly Summary' && session.step === 'summary_select_type') {
      saveCurrentState(session);
      session.data.summaryType = 'yearly';
      session.step = 'summary_select_year';
      await sendTelegramMessage(
        chatId,
        '📆 <b>Yearly Summary</b>\n\nSelect year:',
        createYearSelectionKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('📅 ') && session.step === 'summary_select_year') {
      const year = parseYearFromText(text);
      
      if (year > 0) {
        saveCurrentState(session);
        session.data.selectedYear = year;
        
        if (session.data.summaryType === 'monthly') {
          session.step = 'summary_select_month';
          await sendTelegramMessage(
            chatId,
            `📅 <b>Monthly Summary - ${year}</b>\n\nSelect month:`,
            createMonthSelectionKeyboard()
          );
        } else {
          const { start, end } = getYearDateRange(year);
          await generateSummaryReport(chatId, start, end, `Year ${year}`);
          resetSession(userId);
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('📅 ') && session.step === 'summary_select_month') {
      const month = parseMonthFromText(text);
      
      if (month >= 0) {
        const year = session.data.selectedYear;
        const { start, end } = getMonthDateRange(year, month);
        const monthName = text.replace('📅 ', '');
        await generateSummaryReport(chatId, start, end, `${monthName} ${year}`);
        resetSession(userId);
      }
      return NextResponse.json({ ok: true });
    }

    if (text === '📊 View Recent') {
      const recentTransactions = await getRecentTransactions(5);
      
      if (recentTransactions.length === 0) {
        await sendTelegramMessage(chatId, '📊 No transactions yet.', createMainMenuKeyboard());
      } else {
        let message = '📊 <b>Recent Transactions:</b>\n\n';
        
        recentTransactions.forEach((row, index) => {
          if (index === 0) return;
          message += `<b>${row[1]}</b> - ${formatCurrency(row[6])}\n`;
          message += `📅 ${row[0]}\n`;
          message += `📁 ${row[2]}\n`;
          message += `💳 ${row[3]}${row[4] ? ` → ${row[4]}` : ''}\n`;
          message += `📝 ${row[5]}\n\n`;
        });
        
        await sendTelegramMessage(chatId, message, createMainMenuKeyboard());
      }
      return NextResponse.json({ ok: true });
    }

    if (text === '💸 Add Expense') {
      saveCurrentState(session);
      session.step = 'category';
      session.data = { type: TRANSACTION_TYPES.EXPENSE };
      await sendTelegramMessage(
        chatId,
        '💸 <b>Adding Expense</b>\n\nSelect category:',
        createCategoryKeyboard('EXPENSE')
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '💰 Add Income') {
      saveCurrentState(session);
      session.step = 'category';
      session.data = { type: TRANSACTION_TYPES.INCOME };
      await sendTelegramMessage(
        chatId,
        '💰 <b>Adding Income</b>\n\nSelect category:',
        createCategoryKeyboard('INCOME')
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '🔄 Add Transfer') {
      saveCurrentState(session);
      session.step = 'account1';
      session.data = { type: TRANSACTION_TYPES.TRANSFER, category: '' };
      await sendTelegramMessage(
        chatId,
        '🔄 <b>Adding Transfer</b>\n\nSelect source (Account #1):',
        createAccountKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '💳 Add Reimbursement') {
      saveCurrentState(session);
      session.step = 'account1';
      session.data = { type: TRANSACTION_TYPES.REIMBURSEMENT, category: 'Reimbursibles' };
      await sendTelegramMessage(
        chatId,
        '💳 <b>Adding Reimbursement</b>\n\nSelect account:',
        createAccountKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'category') {
      const typeKey = session.data.type === TRANSACTION_TYPES.EXPENSE ? 'EXPENSE' : 'INCOME';
      const validCategories = CATEGORIES[typeKey];
      
      if (validCategories.includes(text)) {
        saveCurrentState(session);
        session.data.category = text;
        session.step = 'account1';
        await sendTelegramMessage(
          chatId,
          `✅ Category: <b>${text}</b>\n\nSelect account:`,
          createAccountKeyboard()
        );
      } else {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid. Select from buttons:',
          createCategoryKeyboard(typeKey)
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'account1') {
      if (ACCOUNTS.includes(text)) {
        saveCurrentState(session);
        session.data.account1 = text;
        
        if (session.data.type === TRANSACTION_TYPES.TRANSFER) {
          session.step = 'account2';
          await sendTelegramMessage(
            chatId,
            `✅ Source: <b>${text}</b>\n\nSelect destination:`,
            createAccountKeyboard()
          );
        } else {
          session.step = 'description';
          await sendTelegramMessage(
            chatId,
            `✅ Account: <b>${text}</b>\n\n📝 Enter description:`,
            {
              keyboard: [[{ text: '🔙 Back' }]],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'account2') {
      if (ACCOUNTS.includes(text)) {
        saveCurrentState(session);
        session.data.account2 = text;
        session.step = 'description';
        await sendTelegramMessage(
          chatId,
          `✅ Destination: <b>${text}</b>\n\n📝 Enter description:`,
          {
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'description') {
      saveCurrentState(session);
      session.data.description = text;
      session.step = 'amount';
      await sendTelegramMessage(
        chatId,
        `✅ Description: <b>${text}</b>\n\n💵 Enter amount:`,
        {
          keyboard: [[{ text: '🔙 Back' }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (session.step === 'amount') {
      let amount = parseAmount(text);
      
      if (isNaN(amount) || amount <= 0) {
        await sendTelegramMessage(
          chatId,
          '❌ Invalid amount:',
          {
            keyboard: [[{ text: '🔙 Back' }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        );
        return NextResponse.json({ ok: true });
      }

      if (session.data.type === TRANSACTION_TYPES.EXPENSE) {
        amount = -Math.abs(amount);
      }

      try {
        await addTransactionToSheet({
          date: getCurrentDateTime(),
          type: session.data.type,
          category: session.data.category,
          account1: session.data.account1,
          account2: session.data.account2 || '',
          description: session.data.description,
          amount,
        });

        let summary = `✅ <b>Saved!</b>\n\n`;
        summary += `📊 Type: ${session.data.type}\n`;
        summary += `📁 Category: ${session.data.category || 'N/A'}\n`;
        summary += `💳 Account: ${session.data.account1}`;
        if (session.data.account2) {
          summary += ` → ${session.data.account2}`;
        }
        summary += `\n📝 Description: ${session.data.description}\n`;
        summary += `💰 Amount: ${formatCurrency(amount)}\n`;

        resetSession(userId);
        
        await sendTelegramMessage(chatId, summary, createMainMenuKeyboard());
      } catch (error) {
        console.error('❌ Error saving:', error);
        await sendTelegramMessage(chatId, '❌ Error saving.', createMainMenuKeyboard());
        resetSession(userId);
      }
      
      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(chatId, 'Use menu buttons:', createMainMenuKeyboard());

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ ok: true });
  }
}

async function generateSummaryReport(
  chatId: number,
  startDate: Date,
  endDate: Date,
  periodName: string
) {
  try {
    const transactions = await getTransactionsByDateRange(startDate, endDate);
    
    if (transactions.length === 0) {
      await sendTelegramMessage(
        chatId,
        `📊 <b>${periodName} Summary</b>\n\nNo transactions.\n\n📅 ${startDate.toLocaleDateString('en-PH')} - ${endDate.toLocaleDateString('en-PH')}`,
        createMainMenuKeyboard()
      );
      return;
    }

    const summary = calculateSummary(transactions);
    
    let report = `📊 <b>${periodName} Summary</b>\n\n`;
    report += `📅 ${startDate.toLocaleDateString('en-PH')} - ${endDate.toLocaleDateString('en-PH')}\n`;
    report += `📝 Transactions: ${summary.transactionCount}\n\n`;
    
    report += `💰 <b>INCOME</b>\n`;
    report += `Total: ${formatCurrency(summary.totalIncome)}\n`;
    if (Object.keys(summary.incomeByCategory).length > 0) {
      report += `\nBreakdown:\n`;
      Object.entries(summary.incomeByCategory).forEach(([category, amount]) => {
        report += `  • ${category}: ${formatCurrency(amount)}\n`;
      });
    }
    
    report += `\n💸 <b>EXPENSES</b>\n`;
    report += `Total: ${formatCurrency(summary.totalExpense)}\n`;
    if (Object.keys(summary.expenseByCategory).length > 0) {
      report += `\nBreakdown:\n`;
      Object.entries(summary.expenseByCategory).forEach(([category, amount]) => {
        report += `  • ${category}: ${formatCurrency(amount)}\n`;
      });
    }
    
    report += `\n━━━━━━━━━━━━━━━━━\n`;
    report += `📈 <b>NET INCOME</b>\n`;
    report += `${formatCurrency(summary.netIncome)}\n`;
    
    if (summary.netIncome > 0) {
      report += `\n✅ You saved money!`;
    } else if (summary.netIncome < 0) {
      report += `\n⚠️ You spent more than earned.`;
    } else {
      report += `\n➖ Break even.`;
    }
    
    await sendTelegramMessage(chatId, report, createMainMenuKeyboard());
  } catch (error) {
    console.error('❌ Error:', error);
    await sendTelegramMessage(chatId, '❌ Error.', createMainMenuKeyboard());
  }
}
