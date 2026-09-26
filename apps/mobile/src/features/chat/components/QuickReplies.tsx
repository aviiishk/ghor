import { Pressable, ScrollView, Text } from 'react-native';

// Root CLAUDE.md §16.6: hardcoded suggestion strings, not dynamic — tapping one inserts
// its text into the message input, it does not send immediately.
const QUICK_REPLIES = [
  'Is parking available?',
  'Is WiFi included?',
  'Can I visit today?',
  'Security deposit?',
];

export function QuickReplies({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 pb-2"
    >
      {QUICK_REPLIES.map((text) => (
        <Pressable
          key={text}
          onPress={() => onSelect(text)}
          className="bg-white border border-primary rounded-full px-3 py-1.5"
        >
          <Text className="text-primary text-xs font-semibold">{text}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
