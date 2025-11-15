/**
 * Dashboard Page (Optional)
 * Simple landing page - main functionality is in Telegram bot
 */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            💰 Personal Finance Tracker
          </h1>
          <p className="text-gray-600 text-lg">
            Telegram Bot + Google Sheets Integration
          </p>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8 rounded-r-lg">
          <h2 className="text-xl font-semibold text-blue-900 mb-3">
            🚀 Your Bot is Running!
          </h2>
          <p className="text-blue-800 mb-4">
            Open Telegram and start chatting with your bot to track your finances.
          </p>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Find your bot on Telegram:</p>
            <p className="font-mono text-blue-600 font-semibold">
              @your_bot_username
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
            <div className="text-3xl mb-3">💸</div>
            <h3 className="font-semibold text-gray-900 mb-2">Track Expenses</h3>
            <p className="text-gray-600 text-sm">
              Record your daily expenses with detailed categories
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="font-semibold text-gray-900 mb-2">Log Income</h3>
            <p className="text-gray-600 text-sm">
              Track all your income sources and earnings
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-semibold text-gray-900 mb-2">Transfers</h3>
            <p className="text-gray-600 text-sm">
              Move money between accounts seamlessly
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
            <div className="text-3xl mb-3">💳</div>
            <h3 className="font-semibold text-gray-900 mb-2">Reimbursements</h3>
            <p className="text-gray-600 text-sm">
              Keep track of expenses to be reimbursed
            </p>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-3">
            🔒 Security Features
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Only authorized Telegram users can access</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Data saved securely to your private Google Sheet</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Real-time synchronization and backup</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            This application is running and ready to receive transactions from Telegram.
          </p>
        </div>
      </div>
    </div>
  );
}
