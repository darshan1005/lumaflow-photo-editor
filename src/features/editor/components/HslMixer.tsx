import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

const CHANNELS = [
  { id: 0, name: 'Red', color: '#ef4444' },
  { id: 1, name: 'Orange', color: '#f97316' },
  { id: 2, name: 'Yellow', color: '#eab308' },
  { id: 3, name: 'Green', color: '#22c55e' },
  { id: 4, name: 'Aqua', color: '#06b6d4' },
  { id: 5, name: 'Blue', color: '#3b82f6' },
  { id: 6, name: 'Purple', color: '#a855f7' },
  { id: 7, name: 'Magenta', color: '#ec4899' }
];

export const HslMixer: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<number>(0);
  const mixer = useEditorStore(state => state.currentDocument.hslMixer);
  const updateHslMixer = useEditorStore(state => state.updateHslMixer);
  const beginAdjustment = useEditorStore(state => state.beginAdjustment);
  const endAdjustment = useEditorStore(state => state.endAdjustment);

  const currentChannelData = mixer[activeChannel];
  const channelInfo = CHANNELS[activeChannel];

  return (
    <View style={styles.outerContainer}>
      {/* 8 Channel Dots */}
      <View style={styles.dotsRow}>
        {CHANNELS.map(ch => {
          const isActive = activeChannel === ch.id;
          const chData = mixer[ch.id];
          const hasShift = chData.hue !== 0 || chData.saturation !== 0 || chData.luminance !== 0;
          return (
            <TouchableOpacity
              key={ch.id}
              style={[
                styles.dot,
                { backgroundColor: ch.color },
                isActive && styles.dotActive
              ]}
              onPress={() => setActiveChannel(ch.id)}
            >
              {hasShift && <View style={styles.dotIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.channelName}>{channelInfo.name.toUpperCase()} CHANNEL ADJUSTMENT</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <AdjustmentSlider
          label="Hue Shift"
          value={currentChannelData.hue}
          min={-100}
          max={100}
          unit="°"
          onChange={v => updateHslMixer(activeChannel, 'hue', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateHslMixer(activeChannel, 'hue', 0)}
        />
        <AdjustmentSlider
          label="Saturation"
          value={currentChannelData.saturation}
          min={-100}
          max={100}
          unit="%"
          onChange={v => updateHslMixer(activeChannel, 'saturation', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateHslMixer(activeChannel, 'saturation', 0)}
        />
        <AdjustmentSlider
          label="Luminance"
          value={currentChannelData.luminance}
          min={-100}
          max={100}
          onChange={v => updateHslMixer(activeChannel, 'luminance', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateHslMixer(activeChannel, 'luminance', 0)}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    height: 270,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
  dotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  channelName: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.xs,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xl,
  },
});
