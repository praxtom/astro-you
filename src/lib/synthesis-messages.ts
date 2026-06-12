export interface SynthesisMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  clientId?: string;
  pending?: boolean;
  metadata?: {
    chartIncluded?: boolean;
    remedySuggested?: boolean;
    tokens?: number;
  };
}

export function mergeSynthesisMessages(
  welcomeMessage: SynthesisMessage,
  persistedMessages: SynthesisMessage[],
  pendingMessages: SynthesisMessage[],
): SynthesisMessage[] {
  const confirmedClientIds = new Set(
    persistedMessages
      .map((message) => message.clientId)
      .filter((clientId): clientId is string => Boolean(clientId)),
  );

  const unconfirmedPendingMessages = pendingMessages.filter(
    (message) =>
      !message.clientId || !confirmedClientIds.has(message.clientId),
  );

  return [welcomeMessage, ...persistedMessages, ...unconfirmedPendingMessages];
}

export function hasVisibleStreamingContent(
  content: string | null,
): content is string {
  return typeof content === "string" && content.trim().length > 0;
}
