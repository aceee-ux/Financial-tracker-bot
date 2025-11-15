/**
 * Security Module - Authorization Check
 * Only allows specific Telegram users to use the bot
 */

export function isAuthorizedUser(userId: number): boolean {
  const authorizedUserId = process.env.AUTHORIZED_USER_ID;
  const authorizedUserIds = process.env.AUTHORIZED_USER_IDS;

  // Check single user ID
  if (authorizedUserId && userId.toString() === authorizedUserId) {
    return true;
  }

  // Check multiple user IDs (comma-separated)
  if (authorizedUserIds) {
    const allowedIds = authorizedUserIds.split(',').map(id => id.trim());
    if (allowedIds.includes(userId.toString())) {
      return true;
    }
  }

  return false;
}

export function getUnauthorizedMessage(): string {
  return "🚫 Unauthorized access. This bot is private and only accessible to authorized users.";
}
