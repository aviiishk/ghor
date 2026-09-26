// Root CLAUDE.md §16.6: hardcoded suggestion strings — tapping one inserts its text into
// the message input, it does not send immediately. Same list as
// apps/mobile/src/features/chat/components/QuickReplies.tsx.
const QUICK_REPLIES = [
  'Is parking available?',
  'Is WiFi included?',
  'Can I visit today?',
  'Security deposit?',
];

export function QuickReplies({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-2">
      {QUICK_REPLIES.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          className="shrink-0 bg-white border border-primary text-primary text-xs font-semibold rounded-full px-3 py-1.5"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
