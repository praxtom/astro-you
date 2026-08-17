import { useCallback, useEffect, useRef } from "react";
import type {
  ChangeEventHandler,
  FormEventHandler,
  KeyboardEventHandler,
  MutableRefObject,
  Ref,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  History,
  Loader2,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";

export function appendDictationTranscript(
  current: string,
  transcript: string,
): string {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return current;
  const normalizedCurrent = current.trimEnd();
  return normalizedCurrent
    ? `${normalizedCurrent} ${normalizedTranscript}`
    : normalizedTranscript;
}

interface ComposerVoiceButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
}

export function ComposerVoiceButton({
  isListening,
  isSupported,
  onToggle,
}: ComposerVoiceButtonProps) {
  const label = !isSupported
    ? "Voice dictation is unavailable in this browser"
    : isListening
      ? "Stop voice dictation"
      : "Start voice dictation";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!isSupported}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        isListening
          ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
          : "text-white/35 hover:bg-white/5 hover:text-gold"
      }`}
      aria-label={label}
      title={label}
      aria-pressed={isListening}
    >
      {isListening ? (
        <Square size={13} fill="currentColor" />
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}

interface SynthesisComposerTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  composerRef?: Ref<HTMLDivElement>;
}

export function SynthesisComposerTextarea({
  value,
  onValueChange,
  onKeyDown,
  composerRef,
}: SynthesisComposerTextareaProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const setComposerRef = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof composerRef === "function") composerRef(node);
      else if (composerRef) {
        (composerRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [composerRef],
  );

  /**
   * Sync *external* value changes into the DOM — dictation, a tapped
   * suggested question, clearing after send, restoring a failed draft.
   *
   * This effect is deliberately the ONLY writer of the composer's text. The
   * value used to also be rendered as a JSX child (`{value}`), which meant
   * React reconciled the same text node the browser was editing: every
   * keystroke rewrote the node, which collapses the caret to offset 0, so
   * the next character landed at the start and the input typed backwards
   * ("Hey1!" became "!1yeH").
   *
   * After local typing the DOM already matches `value`, so the guard below
   * is false and nothing is written — the caret is left alone. It only
   * writes when the change came from outside, and then restores the caret to
   * the end, because assigning innerText discards the selection.
   */
  useEffect(() => {
    const composer = localRef.current;
    if (!composer || composer.innerText === value) return;

    composer.innerText = value;

    // Only touch the selection if the user is actually in this box —
    // otherwise a background update would steal the caret.
    if (document.activeElement !== composer) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false); // false = collapse to the end
    selection.removeAllRanges();
    selection.addRange(range);
  }, [value]);

  const handleInput: FormEventHandler<HTMLDivElement> = (event) => {
    const nextValue = event.currentTarget.innerText.replace(/\r/g, "");
    // Clear the leftover <br> the browser leaves behind, so the placeholder
    // (:empty::before) shows again.
    if (!nextValue) event.currentTarget.replaceChildren();
    onValueChange(nextValue);
  };

  return (
    <div
      ref={setComposerRef}
      contentEditable="plaintext-only"
      role="textbox"
      aria-multiline="true"
      spellCheck={false}
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
      data-lt-active="false"
      data-ms-editor="false"
      aria-label="Ask Jyotish a question"
      data-placeholder="Ask Jyotish…"
      className="max-h-32 min-h-8 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent py-1 font-sans text-sm leading-6 text-white/85 outline-none empty:before:pointer-events-none empty:before:text-white/28 empty:before:content-[attr(data-placeholder)] focus:border-0 focus:outline-none focus:ring-0 md:text-[0.95rem]"
      onInput={handleInput}
      onKeyDown={onKeyDown}
      // No children: the text is owned by the browser and synced by the
      // effect above. Rendering {value} here made React reconcile the very
      // text node being edited, resetting the caret on every keystroke.
    />
  );
}

interface BlueprintPanelControlsProps {
  credits: number;
  isPaying: boolean;
  isOpen: boolean;
  onAddCredits: () => void;
  onToggleBlueprint: () => void;
  toggleButtonRef?: Ref<HTMLButtonElement>;
}

interface BlueprintToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

export function BlueprintToggleButton({
  isOpen,
  onToggle,
  buttonRef,
}: BlueprintToggleButtonProps) {
  const label = isOpen ? "Collapse right sidebar" : "Open right sidebar";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-center rounded-xl p-2 transition-colors ${
        isOpen ? "text-gold" : "text-white/35 hover:text-gold"
      }`}
      title={label}
      aria-label={label}
      aria-expanded={isOpen}
      aria-controls="synthesis-blueprint-panel"
    >
      {isOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
    </button>
  );
}

export function BlueprintPanelControls({
  credits,
  isPaying,
  isOpen,
  onAddCredits,
  onToggleBlueprint,
  toggleButtonRef,
}: BlueprintPanelControlsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/5 p-1 text-gold">
        <div className="flex items-center gap-1.5 px-2 text-[0.65rem] font-mono">
          <Sparkles size={10} />
          <span className="font-sans text-white/55">Credits</span>
          <span>{credits} min</span>
        </div>
        <button
          type="button"
          onClick={onAddCredits}
          disabled={isPaying}
          className="flex h-6 items-center gap-1 rounded-full bg-gold/10 px-2 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          title="Add more minutes"
          aria-label="Add more minutes"
        >
          {isPaying ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Plus size={11} />
          )}
          <span>{isPaying ? "Adding" : "Add"}</span>
        </button>
      </div>
      <BlueprintToggleButton
        isOpen={isOpen}
        onToggle={onToggleBlueprint}
        buttonRef={toggleButtonRef}
      />
    </div>
  );
}

type SynthesisChartType = "D1" | "D9";

const CHART_TYPE_DETAILS: Record<
  SynthesisChartType,
  { name: string; description: string }
> = {
  D1: {
    name: "Natal chart",
    description: "Your overall life, personality, and planetary foundation.",
  },
  D9: {
    name: "Navamsa",
    description: "Marriage, dharma, and planetary maturity.",
  },
};

interface ChartTypeSelectorProps {
  value: SynthesisChartType;
  loading: boolean;
  onChange: (value: SynthesisChartType) => void;
}

export function ChartTypeSelector({
  value,
  loading,
  onChange,
}: ChartTypeSelectorProps) {
  const details = CHART_TYPE_DETAILS[value];
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onChange(event.target.value as SynthesisChartType);
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-1 font-mono text-[0.62rem] font-bold text-gold">
          {value}
        </span>
        <div className="min-w-0 flex-1">
          <div className="relative">
            <select
              aria-label="Select chart type"
              value={value}
              onChange={handleChange}
              className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-6 font-display text-lg italic text-white/85 transition-colors hover:text-gold focus:ring-0"
            >
              <option value="D1" className="bg-black not-italic">
                Natal chart
              </option>
              <option value="D9" className="bg-black not-italic">
                Navamsa
              </option>
            </select>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/40"
            />
          </div>
          <p className="mt-1 text-xs leading-5 text-white/40">
            {details.description}
          </p>
          {loading && (
            <p
              role="status"
              className="mt-1 flex items-center gap-1.5 text-[0.62rem] text-gold/75"
            >
              <Loader2 size={10} className="animate-spin" />
              <span>Calculating {value} chart</span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 h-px bg-linear-to-r from-gold/25 to-transparent" />
    </div>
  );
}

interface ConversationPanelHeaderProps {
  onNewConversation: () => void;
  onHome: () => void;
  onClose: () => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
}

export function ConversationPanelHeader({
  onNewConversation,
  onHome,
  onClose,
  closeButtonRef,
}: ConversationPanelHeaderProps) {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/45 transition-colors hover:bg-white/5 hover:text-gold"
        >
          <ChevronLeft size={16} />
          <span>Home</span>
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/5 hover:text-white/70"
          aria-label="Close conversations"
        >
          <X size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={onNewConversation}
        className="group mt-1 flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Plus
          size={17}
          className="shrink-0 text-white/55 transition-transform group-hover:rotate-90"
        />
        <span className="truncate">New conversation</span>
      </button>
    </div>
  );
}

interface SynthesisPanelLaunchersProps {
  canOpenConversations: boolean;
  conversationsOpen: boolean;
  blueprintOpen: boolean;
  onOpenConversations: () => void;
  onOpenBlueprint: () => void;
  conversationsButtonRef?: Ref<HTMLButtonElement>;
  blueprintButtonRef?: Ref<HTMLButtonElement>;
}

export function SynthesisPanelLaunchers({
  canOpenConversations,
  conversationsOpen,
  blueprintOpen,
  onOpenConversations,
  onOpenBlueprint,
  conversationsButtonRef,
  blueprintButtonRef,
}: SynthesisPanelLaunchersProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between p-3">
      <div>
        {canOpenConversations && !conversationsOpen && (
          <button
            ref={conversationsButtonRef}
            type="button"
            onClick={onOpenConversations}
            className="pointer-events-auto rounded-xl border border-white/8 bg-bg-app/85 p-2.5 text-white/40 backdrop-blur-xl transition-colors hover:text-gold"
            aria-label="Open conversations"
            aria-controls="synthesis-conversations-panel"
          >
            <History size={16} />
          </button>
        )}
      </div>
      {!blueprintOpen && (
        <button
          ref={blueprintButtonRef}
          type="button"
          onClick={onOpenBlueprint}
          className="pointer-events-auto rounded-xl border border-white/8 bg-bg-app/85 p-2.5 text-white/40 backdrop-blur-xl transition-colors hover:text-gold"
          aria-label="Open blueprint"
          aria-controls="synthesis-blueprint-panel"
        >
          <PanelRightOpen size={16} />
        </button>
      )}
    </div>
  );
}

interface SynthesisHeaderNavigationProps {
  historyOpen: boolean;
  onHome: () => void;
  onToggleHistory: () => void;
  historyButtonRef?: Ref<HTMLButtonElement>;
}

export function SynthesisHeaderNavigation({
  historyOpen,
  onHome,
  onToggleHistory,
  historyButtonRef,
}: SynthesisHeaderNavigationProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onHome}
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-white/45 transition-colors hover:text-gold"
      >
        <ChevronLeft size={16} />
        <span>Home</span>
      </button>
      <button
        ref={historyButtonRef}
        type="button"
        onClick={onToggleHistory}
        className={`rounded-xl p-2 transition-colors ${
          historyOpen ? "text-gold" : "text-white/35 hover:text-gold"
        }`}
        title="Conversations"
        aria-label="Toggle conversations"
        aria-expanded={historyOpen}
        aria-controls="synthesis-conversations-panel"
      >
        <History size={15} />
      </button>
    </div>
  );
}

export interface ConversationListItem {
  id: string;
  title?: string;
}

interface ConversationListViewProps {
  chats: ConversationListItem[];
  currentId: string | null;
  searchQuery: string;
  searchOpen: boolean;
  collapsed: boolean;
  confirmingDelete: string | null;
  onSearchChange: (value: string) => void;
  onToggleSearch: () => void;
  onToggleCollapsed: () => void;
  onSelect: (id: string) => void;
  onDeleteClick: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

export function ConversationListView({
  chats,
  currentId,
  searchQuery,
  searchOpen,
  collapsed,
  confirmingDelete,
  onSearchChange,
  onToggleSearch,
  onToggleCollapsed,
  onSelect,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
}: ConversationListViewProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredChats = normalizedQuery
    ? chats.filter((chat) =>
        (chat.title || "Untitled Synthesis")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : chats;

  return (
    <div className="flex flex-col px-2 pb-3">
      <div className="flex items-center justify-between px-2 pb-2 pt-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-w-0 items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white/75"
          aria-expanded={!collapsed}
        >
          <span>Recents</span>
          <ChevronDown
            size={13}
            className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={onToggleSearch}
          className={`rounded-lg p-1.5 transition-colors ${
            searchOpen
              ? "bg-white/8 text-white/75"
              : "text-white/35 hover:bg-white/5 hover:text-white/70"
          }`}
          aria-label={
            searchOpen ? "Close conversation search" : "Search conversations"
          }
          aria-expanded={searchOpen}
        >
          {searchOpen ? <X size={15} /> : <Search size={15} />}
        </button>
      </div>

      {searchOpen && (
        <div className="px-1 pb-2">
          <input
            name="conversation-search"
            autoComplete="off"
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search conversations"
            autoFocus
            className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/80 placeholder:text-white/30 focus:border-white/20 focus:outline-none"
          />
        </div>
      )}

      {!collapsed &&
        (filteredChats.length === 0 ? (
          <p className="px-3 py-3 text-xs text-white/25">
            {searchQuery
              ? "No matching conversations."
              : "No past conversations."}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5" role="list">
            {filteredChats.map((chat) => {
              const isCurrent = currentId === chat.id;
              const isConfirming = confirmingDelete === chat.id;

              return (
                <div
                  key={chat.id}
                  role="listitem"
                  className={`group relative flex min-w-0 items-center rounded-lg transition-colors ${
                    isCurrent ? "bg-white/8" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    aria-current={isCurrent ? "page" : undefined}
                    className="min-w-0 flex-1 truncate px-3 py-2.5 pr-10 text-left text-sm text-white/72"
                  >
                    {chat.title || "Untitled Synthesis"}
                  </button>

                  {isConfirming ? (
                    <div className="absolute right-1 flex items-center gap-0.5 rounded-md bg-[#17171d] p-0.5 shadow-lg">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onConfirmDelete(chat.id);
                        }}
                        className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/15"
                        aria-label="Confirm delete"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCancelDelete();
                        }}
                        className="rounded p-1 text-white/45 transition-colors hover:bg-white/8 hover:text-white/75"
                        aria-label="Cancel delete"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteClick(chat.id);
                      }}
                      className="absolute right-1.5 rounded-md p-1.5 text-white/30 opacity-0 transition-[color,background-color,opacity] hover:bg-white/8 hover:text-white/70 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={`Delete ${chat.title || "conversation"}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
