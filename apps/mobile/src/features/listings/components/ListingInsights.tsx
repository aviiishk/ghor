import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useListingInsights } from '../hooks';
import type { ListingInsights as Insights } from '../api';
import { colors } from '@/lib/tokens';

// Mirrors apps/web's ListingInsights (same data, same dataviz rules): stat tiles, one
// single-series column chart of daily views in primary blue (validated ≥3:1 on white),
// no legend, 2px gaps, ≤24px bars, rounded data-ends. Touch has no hover, so a tap
// selects a bar and the readout line above the chart shows that day (default: today);
// "Show as list" is the table view so nothing depends on tapping.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1);
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

const CHART_H = 140;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="bg-white border border-hairline rounded-2xl px-4 py-3" style={{ width: '48%' }}>
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-2xl font-semibold text-ink mt-0.5">{value}</Text>
      {hint && <Text className="text-xs text-muted-soft mt-0.5">{hint}</Text>}
    </View>
  );
}

function ViewsChart({ daily }: { daily: Insights['daily'] }) {
  const [selected, setSelected] = useState(daily.length - 1);
  const [showList, setShowList] = useState(false);
  const max = niceMax(Math.max(...daily.map((d) => d.views)));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, max / 2, max];
  const day = daily[selected]!;

  return (
    <View>
      {/* Readout for the tapped bar — the touch equivalent of the web tooltip. */}
      <View className="flex-row items-center mb-2" accessibilityLiveRegion="polite">
        <Text className="text-xs text-muted mr-2">
          {selected === daily.length - 1 ? 'Today' : shortDate(day.date)}
        </Text>
        <View style={{ width: 12, height: 2, backgroundColor: colors.primary, marginRight: 6 }} />
        <Text className="text-xs text-ink font-semibold">{day.views}</Text>
        <Text className="text-xs text-muted ml-1">{plural(day.views, 'view', 'views')}</Text>
        <Text className="text-xs text-ink font-semibold ml-3">{day.inquiries}</Text>
        <Text className="text-xs text-muted ml-1">
          {plural(day.inquiries, 'inquiry', 'inquiries')}
        </Text>
      </View>

      <View className="flex-row">
        <View style={{ width: 22, height: CHART_H }}>
          {ticks.map((t) => (
            <Text
              key={t}
              className="text-muted-soft"
              style={{
                position: 'absolute',
                right: 4,
                fontSize: 10,
                top: CHART_H - (t / max) * CHART_H - 6,
              }}
            >
              {compact(t)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, height: CHART_H }}>
          {ticks.map((t) => (
            <View
              key={t}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: CHART_H - (t / max) * CHART_H,
                height: 1,
                backgroundColor: colors['hairline-soft'],
              }}
            />
          ))}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
            {daily.map((d, i) => (
              <Pressable
                key={d.date}
                onPress={() => setSelected(i)}
                accessibilityLabel={`${shortDate(d.date)}: ${d.views} ${plural(d.views, 'view', 'views')}, ${d.inquiries} ${plural(d.inquiries, 'inquiry', 'inquiries')}`}
                // Whole column slot is the touch target; 1px margins = the 2px surface gap.
                style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', marginHorizontal: 1 }}
              >
                <View
                  style={{
                    width: '100%',
                    maxWidth: 24,
                    height: d.views ? (d.views / max) * CHART_H : 1,
                    opacity: d.views ? 1 : 0.35,
                    backgroundColor: i === selected ? colors['primary-pressed'] : colors.primary,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="flex-row justify-between mt-1.5" style={{ paddingLeft: 22 }}>
        <Text className="text-muted-soft" style={{ fontSize: 10 }}>
          {shortDate(daily[0]!.date)}
        </Text>
        <Text className="text-muted-soft" style={{ fontSize: 10 }}>
          {shortDate(daily[Math.floor(daily.length / 2)]!.date)}
        </Text>
        <Text className="text-muted-soft" style={{ fontSize: 10 }}>
          Today
        </Text>
      </View>

      <Pressable onPress={() => setShowList((v) => !v)} className="mt-3 py-1">
        <Text className="text-xs text-muted">{showList ? 'Hide list' : 'Show as list'}</Text>
      </Pressable>
      {showList && (
        <View className="border border-hairline rounded-xl mt-1">
          <View className="flex-row bg-surface px-3 py-2">
            <Text className="flex-1 text-xs text-muted font-semibold">Date</Text>
            <Text className="w-16 text-right text-xs text-muted font-semibold">Views</Text>
            <Text className="w-20 text-right text-xs text-muted font-semibold">Inquiries</Text>
          </View>
          {[...daily].reverse().map((d) => (
            <View key={d.date} className="flex-row px-3 py-1.5 border-t border-hairline-soft">
              <Text className="flex-1 text-sm text-ink">{shortDate(d.date)}</Text>
              <Text className="w-16 text-right text-sm text-ink">{d.views}</Text>
              <Text className="w-20 text-right text-sm text-ink">{d.inquiries}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function ListingInsights({ listingId }: { listingId: string }) {
  const { data, isLoading, isError } = useListingInsights(listingId, true);

  return (
    <View className="border-t border-hairline pt-5 mt-5">
      <View className="flex-row items-baseline justify-between mb-4">
        <Text className="text-xl font-semibold text-ink">Insights</Text>
        <Text className="text-xs text-muted">Only you can see this</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : isError || !data ? (
        <Text className="text-muted">Couldn't load insights right now.</Text>
      ) : (
        <>
          <View className="flex-row flex-wrap justify-between mb-5" style={{ rowGap: 10 }}>
            <StatTile
              label="Views"
              value={compact(data.totals.views)}
              hint={`${compact(data.totals.uniqueViewers)} ${plural(data.totals.uniqueViewers, 'person', 'people')}`}
            />
            <StatTile label="Call / chat taps" value={compact(data.totals.contactTaps)} />
            <StatTile label="Inquiries" value={compact(data.totals.inquiries)} hint="people who messaged" />
            <StatTile
              label="Response rate"
              value={data.totals.responseRate != null ? `${data.totals.responseRate}%` : '—'}
              hint={data.totals.inquiries ? `${data.totals.replied} replied` : 'no inquiries yet'}
            />
          </View>

          <Text className="text-sm font-semibold text-ink">Views per day</Text>
          <Text className="text-xs text-muted mb-3">
            Last 30 days · {data.last30.views} {plural(data.last30.views, 'view', 'views')},{' '}
            {data.last30.inquiries} {plural(data.last30.inquiries, 'inquiry', 'inquiries')}
          </Text>
          <ViewsChart daily={data.daily} />
        </>
      )}
    </View>
  );
}
