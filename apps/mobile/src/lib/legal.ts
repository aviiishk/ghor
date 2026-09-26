import * as WebBrowser from 'expo-web-browser';

// The legal pages live on apps/web (public, no login) — one copy, linked from both apps
// and from the Play Store listing.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ghor.co.in';

export function openLegalPage(page: 'privacy' | 'terms') {
  return WebBrowser.openBrowserAsync(`${WEB_URL}/${page}`);
}
