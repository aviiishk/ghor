import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Home, ArrowLeft } from 'lucide-react-native';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <Text className="text-8xl font-bold text-primary mb-2">404</Text>
      <Text className="text-2xl font-bold text-ink mb-2">Looks like you're lost.</Text>
      <Text className="text-muted text-center mb-10">
        The page you're looking for doesn't exist or has been moved.
      </Text>

      <Pressable
        onPress={() => router.replace('/(tabs)')}
        className="flex-row items-center justify-center bg-primary rounded-full w-full py-4 mb-3"
      >
        <Home color="#fff" size={18} />
        <Text className="text-white font-semibold ml-2">Go to Home</Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        className="flex-row items-center justify-center border border-hairline rounded-full w-full py-4"
      >
        <ArrowLeft color="#2563EB" size={18} />
        <Text className="text-primary font-semibold ml-2">Go Back</Text>
      </Pressable>
    </View>
  );
}
