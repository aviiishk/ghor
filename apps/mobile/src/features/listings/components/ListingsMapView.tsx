import { useEffect, useMemo, useRef } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import type { MapPin } from '../api';
import { colors } from '@/lib/tokens';

// OpenStreetMap via Leaflet inside a WebView — not react-native-maps, whose Android
// implementation is Google Maps (the founder chose OSM, 2026-09-25), and not MapLibre
// RN, which can't run in Expo Go. Same rendering as apps/web's ListingsMap.
//
// OSM's public tiles are fine for dev/low traffic but their usage policy forbids heavy
// production use — set EXPO_PUBLIC_MAP_TILE_URL to a real provider before launch.
const TILE_URL =
  process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// Gives the page a real origin, so tile requests carry a Referer (OSM's tile policy
// requires one) instead of coming from about:blank.
const BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ghor.co.in';

const LEAFLET_VERSION = '1.9.4';

export function formatRentShort(rent: number): string {
  if (rent < 1000) return `₹${rent}`;
  const k = rent / 1000;
  return `₹${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

// Static shell; pins arrive afterwards via injectJavaScript so a filter change doesn't
// reload the whole page (and re-download Leaflet/tiles).
function buildHtml(ink: string, primary: string) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@${LEAFLET_VERSION}/dist/leaflet.css">
<script src="https://cdn.jsdelivr.net/npm/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;}
  .pin{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;
    background:${ink};color:#fff;font:700 12px -apple-system,Roboto,sans-serif;
    border-radius:999px;padding:4px 10px;box-shadow:0 1px 3px rgba(15,23,42,.25);}
  .pin.active{background:${primary};}
</style></head><body><div id="map"></div><script>
  var map = L.map('map', { zoomControl: false }).setView([26.1445, 91.7362], 12);
  L.tileLayer(${JSON.stringify(TILE_URL)}, { attribution: ${JSON.stringify(TILE_ATTRIBUTION)}, maxZoom: 19 }).addTo(map);
  var markers = {}; var activeId = null;
  function post(msg){ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function icon(label, active){
    return L.divIcon({ className: '', iconSize: [0,0], iconAnchor: [0,0],
      html: '<span class="pin' + (active ? ' active' : '') + '">' + label + '</span>' });
  }
  window.setPins = function(pins){
    Object.values(markers).forEach(function(m){ map.removeLayer(m.marker); });
    markers = {};
    pins.forEach(function(p){
      var m = L.marker([p.lat, p.lng], { icon: icon(p.label, p.id === activeId) })
        .on('click', function(){ post({ type: 'select', id: p.id }); })
        .addTo(map);
      markers[p.id] = { marker: m, label: p.label };
    });
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
    else if (pins.length > 1) map.fitBounds(pins.map(function(p){ return [p.lat, p.lng]; }), { padding: [40, 40], maxZoom: 15 });
  };
  window.setActive = function(id){
    [activeId, id].forEach(function(k){
      var m = k && markers[k];
      if (m) { m.marker.setIcon(icon(m.label, k === id)); m.marker.setZIndexOffset(k === id ? 1000 : 0); }
    });
    activeId = id;
  };
  map.on('click', function(){ post({ type: 'select', id: null }); });
  post({ type: 'ready' });
</script></body></html>`;
}

export function ListingsMapView({
  pins,
  activeId,
  onSelect,
}: {
  pins: MapPin[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const html = useMemo(() => buildHtml(colors.ink, colors.primary), []);
  const active = pins.find((p) => p.id === activeId) ?? null;

  const payload = useMemo(
    () =>
      JSON.stringify(
        pins.map((p) => ({
          id: p.id,
          lat: p.latitude,
          lng: p.longitude,
          label: formatRentShort(p.rent),
        })),
      ),
    [pins],
  );

  const pushPins = () => {
    webRef.current?.injectJavaScript(`window.setPins(${payload}); true;`);
  };

  useEffect(() => {
    if (ready.current) pushPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  useEffect(() => {
    if (ready.current) {
      webRef.current?.injectJavaScript(`window.setActive(${JSON.stringify(activeId)}); true;`);
    }
  }, [activeId]);

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string | null };
      if (msg.type === 'ready') {
        ready.current = true;
        pushPins();
      } else if (msg.type === 'select') {
        onSelect(msg.id ?? null);
      }
    } catch {
      // ignore malformed messages
    }
  }

  return (
    <View className="flex-1">
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: BASE_URL }}
        onMessage={handleMessage}
        javaScriptEnabled
        // Links in the attribution shouldn't navigate the map WebView itself.
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith(BASE_URL)}
        style={{ flex: 1 }}
      />

      {/* DESIGN.md `map-preview-card`: photo + title + price only. Native, so the tap is
          ordinary app navigation rather than a WebView round-trip. */}
      {active && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
          <Pressable
            onPress={() => router.push(`/listing/${active.id}`)}
            className="flex-row bg-white rounded-2xl overflow-hidden"
            style={{ elevation: 6, shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 12 }}
          >
            {active.imageUrl ? (
              <Image source={{ uri: active.imageUrl }} style={{ width: 104, height: 88 }} />
            ) : (
              <View style={{ width: 104, height: 88 }} className="bg-surface items-center justify-center">
                <Text className="text-muted-soft text-xs">No photo</Text>
              </View>
            )}
            <View className="flex-1 p-3 pr-10 justify-center">
              <Text className="font-semibold text-ink" numberOfLines={1}>
                {active.title}
              </Text>
              <Text className="text-lg font-bold text-ink mt-1">
                ₹{active.rent.toLocaleString('en-IN')}
                <Text className="text-xs font-medium text-muted">/mo</Text>
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => onSelect(null)}
            accessibilityLabel="Close preview"
            hitSlop={8}
            className="w-8 h-8 rounded-full bg-white items-center justify-center"
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            <X size={16} color={colors.ink} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
