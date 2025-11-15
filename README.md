# 💰 Personal Finance Tracker - Telegram Bot

A secure, private Telegram bot that records your financial transactions directly to Google Sheets in real-time.

## 🔒 Security Features

- **User Authorization**: Only authorized Telegram users (by User ID) can use the bot
- **Private Data**: All transactions saved to your personal Google Sheet
- **No Public Access**: The bot rejects unauthorized users automatically
- **Secure Credentials**: All API keys stored in environment variables

---

## 📋 Setup Instructions

### Step 1: Get Your Telegram User ID

1. Open Telegram
2. Search for `@userinfobot`
3. Start a chat and send `/start`
4. Copy your **User ID** (a number like `123456789`)
5. **SAVE THIS NUMBER** - you'll need it for security setup!

### Step 2: Create Your Telegram Bot

1. Search for `@BotFather` on Telegram
2. Send `/newbot`
3. Choose a name (e.g., "My Finance Tracker")
4. Choose a username ending in 'bot' (e.g., "myfinance_tracker_bot")
5. Copy the **bot token** (looks like: `1234567890:ABCdefGHI...`)
6. **SAVE THIS TOKEN**

### Step 3: Setup Google Sheets

#### Create Your Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it: "Financial Transactions"
4. In Row 1, add these headers:
Date | Type | Category | Account1 | Account2 | Description | Amount
5. Copy the **Sheet ID** from the URL (the long string between `/d/` and `/edit`)

#### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project: "Telegram Finance Bot"
3. Enable **Google Sheets API**
4. Go to **Credentials** → **Create Credentials** → **Service Account**
5. Name it "telegram-bot"
6. Click the service account → **Keys** → **Add Key** → **Create new key** → **JSON**
7. Download the JSON file
8. Open the JSON file and copy the `client_email`
9. Go to your Google Sheet → **Share** → Paste the email → Give **Editor** access

### Step 4: Deploy to Vercel

1. Create a [GitHub](https://github.com) account (if you don't have one)
2. Create a new repository
3. Upload all the files from this project
4. Go to [Vercel](https://vercel.com) and sign in with GitHub
5. Click **"Import Project"**
6. Select your repository
7. **Add Environment Variables**:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_step2
AUTHORIZED_USER_ID=your_user_id_from_step1
GOOGLE_SHEET_ID=your_sheet_id_from_step3
GOOGLE_SERVICE_ACCOUNT_EMAIL=email_from_json_file
GOOGLE_PRIVATE_KEY=paste_entire_private_key_with_line_breaks


