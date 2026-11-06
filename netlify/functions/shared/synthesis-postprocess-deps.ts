import { db, FieldValue } from "./firebase-admin.js";
import {
  analyzeUserConsciousness,
  extractActionableAdvice,
  generateConversationSummary,
  type UserContext,
} from "./gemini.js";
import { persistAtmanInsights } from "./atman-brain.js";
import { sanitizePromptText } from "./sanitize.js";
import type { SynthesisPostprocessDeps } from "./synthesis-postprocess.js";

/** Production wiring for runSynthesisPostprocess (Firestore + Gemini). */
export function createSynthesisPostprocessDeps(): SynthesisPostprocessDeps {
  const chatRef = (uid: string, chatId: string) =>
    db.collection("users").doc(uid).collection("chats").doc(chatId);

  return {
    async isMemoryPaused(uid) {
      const snap = await db.collection("users").doc(uid).get();
      return snap.data()?.memoryPaused === true;
    },
    analyze: (messages, context) =>
      analyzeUserConsciousness(messages, context as UserContext),
    extractAdvice: (assistantMessage, userMessage) =>
      extractActionableAdvice(assistantMessage, userMessage),
    persistInsights: (input) =>
      persistAtmanInsights(
        { db },
        {
          uid: input.uid,
          analysisResult: input.analysisResult,
          extractedAdvice: input.extractedAdvice,
          source: {
            surface: "synthesis",
            interactionId: input.interactionId,
            userMessage: input.userMessage,
            assistantMessage: input.assistantMessage,
          },
        },
        { chatId: input.chatId },
      ),
    async readChatSummary(uid, chatId) {
      const snap = await chatRef(uid, chatId).get();
      // The stored summary is model output over user text (and user-editable)
      // — sanitize before it re-enters a prompt.
      return sanitizePromptText(snap.data()?.summary, 600) || undefined;
    },
    summarize: (messages, userName, previousSummary) =>
      generateConversationSummary(messages, userName, previousSummary),
    async writeChatSummary(uid, chatId, summary) {
      // update() (not set/merge) so a chat deleted meanwhile is not recreated.
      await chatRef(uid, chatId).update({
        summary,
        summaryUpdatedAt: FieldValue.serverTimestamp(),
      });
    },
  };
}
