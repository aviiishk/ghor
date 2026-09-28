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
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {QUICK_REPLIES.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          className="press h-8 shrink-0 rounded-full bg-primary-light px-3.5 text-xs font-bold text-primary hover:bg-primary-tint"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
