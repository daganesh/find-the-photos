export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: string;
}

const MAX_MESSAGES = 100;
const rooms = new Map<string, ChatMessage[]>();

export function getMessages(teamId: string, since?: string): ChatMessage[] {
  const msgs = rooms.get(teamId) ?? [];
  if (!since) return msgs;
  return msgs.filter((m) => m.at > since);
}

export function addMessage(teamId: string, msg: ChatMessage): void {
  const msgs = rooms.get(teamId) ?? [];
  msgs.push(msg);
  rooms.set(teamId, msgs.length > MAX_MESSAGES ? msgs.slice(msgs.length - MAX_MESSAGES) : msgs);
}
