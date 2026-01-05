/**
 * Chat type definitions
 */

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: {
        chartIncluded?: boolean;
        remedySuggested?: boolean;
        tokens?: number;
    };
}

export interface ChatConversation {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    archived?: boolean;
    messageCount?: number;
    lastMessage?: string;
}

export interface ChatState {
    conversations: ChatConversation[];
    currentConversationId: string | null;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
}
