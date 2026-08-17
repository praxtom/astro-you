import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MessageBubble from "../../../src/components/synthesis/MessageBubble.js";
import * as conversationModule from "../../../src/components/synthesis/ConversationsListView.js";
import {
  parseCompletedBirthProfile,
  type CompletedBirthProfile,
} from "../../../src/lib/profile-readiness.js";
import { getDefaultSynthesisRails } from "../../../src/lib/synthesis-layout.js";
import * as synthesisLayout from "../../../src/lib/synthesis-layout.js";
import { createChartShareFile } from "../../../src/lib/chart-share.js";

const COMPLETE_PROFILE: CompletedBirthProfile = {
  name: "Test Seeker",
  gender: "Other",
  dob: "1990-01-15",
  tob: "12:00",
  pob: "New Delhi, India",
  birthTimeUnknown: true,
};

test("createChartShareFile turns the visible chart image into a shareable PNG", async () => {
  const file = createChartShareFile(
    "data:image/png;base64,aGVsbG8=",
    "kundali-d9-test-seeker.png",
  );

  assert.equal(file.name, "kundali-d9-test-seeker.png");
  assert.equal(file.type, "image/png");
  assert.equal(await file.text(), "hello");
});

test("parseCompletedBirthProfile rejects partial onboarding drafts", () => {
  assert.equal(
    parseCompletedBirthProfile(
      JSON.stringify({ name: "Test Seeker", gender: "Other" }),
      "true",
    ),
    null,
  );
  assert.equal(
    parseCompletedBirthProfile(JSON.stringify(COMPLETE_PROFILE), null),
    null,
  );
});

test("parseCompletedBirthProfile accepts only marker-backed complete profiles", () => {
  assert.deepEqual(
    parseCompletedBirthProfile(JSON.stringify(COMPLETE_PROFILE), "true"),
    COMPLETE_PROFILE,
  );
  assert.equal(parseCompletedBirthProfile("not-json", "true"), null);
});

test("getDefaultSynthesisRails closes drawers on mobile", () => {
  assert.deepEqual(getDefaultSynthesisRails(false, true), {
    conversations: false,
    blueprint: false,
  });
  assert.deepEqual(getDefaultSynthesisRails(false, false), {
    conversations: false,
    blueprint: false,
  });
});

test("getDefaultSynthesisRails opens desktop rails according to auth state", () => {
  assert.deepEqual(getDefaultSynthesisRails(true, true), {
    conversations: true,
    blueprint: true,
  });
  assert.deepEqual(getDefaultSynthesisRails(true, false), {
    conversations: false,
    blueprint: true,
  });
});

test("Synthesis conversations use generous spacing between message turns", () => {
  assert.equal(
    (synthesisLayout as Record<string, unknown>).SYNTHESIS_MESSAGE_SPACING_CLASS,
    "space-y-8",
  );
});

test("Synthesis side panels share the centre surface colour", () => {
  assert.equal(
    (synthesisLayout as Record<string, unknown>).SYNTHESIS_PANEL_SURFACE_CLASS,
    "bg-bg-app",
  );
});

test("blueprint panel clearly labels credits and places the collapse control after them", () => {
  const BlueprintPanelControls = (
    conversationModule as unknown as {
      BlueprintPanelControls?: ComponentType<any>;
    }
  ).BlueprintPanelControls;
  assert.ok(BlueprintPanelControls, "BlueprintPanelControls must be exported");

  const html = renderToStaticMarkup(
    createElement(BlueprintPanelControls, {
      credits: 82,
      isPaying: false,
      isOpen: true,
      onAddCredits: () => {},
      onToggleBlueprint: () => {},
    }),
  );

  assert.match(html, />Credits</);
  assert.match(html, />82 min</);
  assert.match(html, />Add</);
  assert.match(html, /aria-label="Collapse right sidebar"/);
  assert.match(html, /lucide-panel-right-close/);
  assert.ok(html.indexOf("82 min") < html.indexOf("Collapse right sidebar"));
  assert.doesNotMatch(html, /The Circle/);
});

test("closed blueprint panel keeps an icon-only reopen control", () => {
  const BlueprintToggleButton = (
    conversationModule as unknown as {
      BlueprintToggleButton?: ComponentType<any>;
    }
  ).BlueprintToggleButton;
  assert.ok(BlueprintToggleButton, "BlueprintToggleButton must be exported");

  const html = renderToStaticMarkup(
    createElement(BlueprintToggleButton, {
      isOpen: false,
      onToggle: () => {},
    }),
  );

  assert.match(html, /aria-label="Open right sidebar"/);
  assert.match(html, /lucide-panel-right-open/);
  assert.doesNotMatch(html, />Blueprint</);
});

test("chart selector explains the active D1 chart and exposes its state", () => {
  const ChartTypeSelector = (
    conversationModule as unknown as {
      ChartTypeSelector?: ComponentType<any>;
    }
  ).ChartTypeSelector;
  assert.ok(ChartTypeSelector, "ChartTypeSelector must be exported");

  const html = renderToStaticMarkup(
    createElement(ChartTypeSelector, {
      value: "D1",
      loading: false,
      onChange: () => {},
    }),
  );

  assert.match(html, />D1</);
  assert.match(html, />Natal chart</);
  assert.match(html, /Your overall life, personality, and planetary foundation/);
  assert.match(html, /aria-label="Select chart type"/);
});

test("chart selector explains D9 and announces recalculation while loading", () => {
  const ChartTypeSelector = (
    conversationModule as unknown as {
      ChartTypeSelector?: ComponentType<any>;
    }
  ).ChartTypeSelector;
  assert.ok(ChartTypeSelector, "ChartTypeSelector must be exported");

  const html = renderToStaticMarkup(
    createElement(ChartTypeSelector, {
      value: "D9",
      loading: true,
      onChange: () => {},
    }),
  );

  assert.match(html, />D9</);
  assert.match(html, />Navamsa</);
  assert.match(html, /Marriage, dharma, and planetary maturity/);
  assert.match(html, /role="status"/);
  assert.match(html, />Calculating D9 chart/);
});

test("assistant messages render as plain text without repeated metadata or a left rule", () => {
  const html = renderToStaticMarkup(
    createElement(MessageBubble, {
      role: "assistant",
      content: "A focused answer.",
    }),
  );

  assert.doesNotMatch(html, /Jyotish|2:48 PM/);
  assert.doesNotMatch(html, /border-l|pl-4/);
  assert.match(html, /class="prose-cosmic "/);
});

test("user messages omit sender metadata and use compact bubble padding", () => {
  const html = renderToStaticMarkup(
    createElement(MessageBubble, {
      role: "user",
      content: "My question",
    }),
  );

  assert.doesNotMatch(html, />You|2:49 PM/);
  assert.match(html, /class="px-4 py-2 rounded-2xl/);
});

test("conversation rail uses compact title-only rows with a soft active state", () => {
  const ConversationListView = (
    conversationModule as unknown as {
      ConversationListView?: ComponentType<any>;
    }
  ).ConversationListView;
  assert.ok(ConversationListView, "ConversationListView must be exported");

  const html = renderToStaticMarkup(
    createElement(ConversationListView, {
      chats: [
        { id: "current", title: "Current guidance", lastUpdatedAt: {} },
        { id: "older", title: "Older guidance", lastUpdatedAt: {} },
      ],
      currentId: "current",
      searchQuery: "",
      searchOpen: false,
      collapsed: false,
      confirmingDelete: null,
      onSearchChange: () => {},
      onToggleSearch: () => {},
      onToggleCollapsed: () => {},
      onSelect: () => {},
      onDeleteClick: () => {},
      onConfirmDelete: () => {},
      onCancelDelete: () => {},
    }),
  );

  assert.match(html, />Recents</);
  assert.match(html, /rounded-lg/);
  assert.match(html, /bg-white\/8/);
  assert.match(html, />Current guidance</);
  assert.match(html, /lucide-trash2/);
  assert.doesNotMatch(html, /lucide-ellipsis/);
  assert.doesNotMatch(html, />Recent<|border-gold|Search conversations…/);
});

test("conversation panel keeps Home and close at the top before New conversation", () => {
  const ConversationPanelHeader = (
    conversationModule as unknown as {
      ConversationPanelHeader?: ComponentType<any>;
    }
  ).ConversationPanelHeader;
  assert.ok(ConversationPanelHeader, "ConversationPanelHeader must be exported");

  const html = renderToStaticMarkup(
    createElement(ConversationPanelHeader, {
      onNewConversation: () => {},
      onHome: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, />Home</);
  assert.match(html, /aria-label="Close conversations"/);
  assert.ok(
    html.indexOf('aria-label="Close conversations"') <
      html.indexOf(">New conversation<"),
  );
});

test("closed side panels expose floating icon-only launchers", () => {
  const SynthesisPanelLaunchers = (
    conversationModule as unknown as {
      SynthesisPanelLaunchers?: ComponentType<any>;
    }
  ).SynthesisPanelLaunchers;
  assert.ok(SynthesisPanelLaunchers, "SynthesisPanelLaunchers must be exported");

  const html = renderToStaticMarkup(
    createElement(SynthesisPanelLaunchers, {
      canOpenConversations: true,
      conversationsOpen: false,
      blueprintOpen: false,
      onOpenConversations: () => {},
      onOpenBlueprint: () => {},
    }),
  );

  assert.match(html, /aria-label="Open conversations"/);
  assert.match(html, /aria-label="Open blueprint"/);
  assert.doesNotMatch(html, />History|>Blueprint/);
});

test("composer uses a modern contenteditable textbox instead of a textarea", () => {
  const SynthesisComposerTextarea = (
    conversationModule as unknown as {
      SynthesisComposerTextarea?: ComponentType<any>;
    }
  ).SynthesisComposerTextarea;
  assert.ok(
    SynthesisComposerTextarea,
    "SynthesisComposerTextarea must be exported",
  );

  const html = renderToStaticMarkup(
    createElement(SynthesisComposerTextarea, {
      value: "A question",
      onValueChange: () => {},
      onKeyDown: () => {},
    }),
  );

  assert.match(html, /contentEditable="plaintext-only"/);
  assert.match(html, /role="textbox"/);
  assert.match(html, /aria-multiline="true"/);
  assert.doesNotMatch(html, /<textarea/);
});

test("dictation appends a trimmed transcript for review", () => {
  const appendDictationTranscript = (
    conversationModule as unknown as {
      appendDictationTranscript?: (current: string, transcript: string) => string;
    }
  ).appendDictationTranscript;
  assert.ok(appendDictationTranscript, "appendDictationTranscript must be exported");

  assert.equal(
    appendDictationTranscript("What is next?", "  Please explain.  "),
    "What is next? Please explain.",
  );
  assert.equal(appendDictationTranscript("", "  New question  "), "New question");
});

test("composer voice control exposes microphone and listening states", () => {
  const ComposerVoiceButton = (
    conversationModule as unknown as {
      ComposerVoiceButton?: ComponentType<any>;
    }
  ).ComposerVoiceButton;
  assert.ok(ComposerVoiceButton, "ComposerVoiceButton must be exported");

  const idleHtml = renderToStaticMarkup(
    createElement(ComposerVoiceButton, {
      isListening: false,
      isSupported: true,
      onToggle: () => {},
    }),
  );
  const listeningHtml = renderToStaticMarkup(
    createElement(ComposerVoiceButton, {
      isListening: true,
      isSupported: true,
      onToggle: () => {},
    }),
  );

  assert.match(idleHtml, /aria-label="Start voice dictation"/);
  assert.match(idleHtml, /lucide-mic/);
  assert.match(listeningHtml, /aria-label="Stop voice dictation"/);
  assert.match(listeningHtml, /lucide-square/);
  assert.doesNotMatch(idleHtml + listeningHtml, /lucide-sparkles/);
});
