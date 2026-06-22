import { getIo } from "./socketServer.js";

export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

export function emitToUser(userId: string, eventName: string, payload: unknown): void {
  const io = getIo();
  if (!io) return;

  if (process.env.NODE_ENV === "development") {
    console.log(`Socket emit: ${eventName} -> user:${userId}`);
  }

  io.to(getUserRoom(userId)).emit(eventName, payload);
}

export function emitToUsers(userIds: string[], eventName: string, payload: unknown): void {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  for (const userId of uniqueUserIds) {
    emitToUser(userId, eventName, payload);
  }
}
