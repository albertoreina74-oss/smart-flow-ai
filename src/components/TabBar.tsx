import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Archive, FileText, Languages, Zap } from 'lucide-react-native';
import { colors, glassShadow, radius, spacing, typography } from '../constants/theme';

export type TabKey = 'home' | 'documents' | 'translate' | 'archive';

const TABS: { key: TabKey; label: string; icon: typeof Zap }[] = [
  { key: 'home', label: 'Flow', icon: Zap },
  { key: 'documents', label: 'Documenti', icon: FileText },
  { key: 'translate', label: 'Traduci', icon: Languages },
  { key: 'archive', label: 'Archivio', icon: Archive },
];

type TabBarProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export function TabBar({ activeTab, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <Pressable
              key={key}
              style={styles.tab}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => {
                if (key !== activeTab) {
                  Haptics.selectionAsync();
                  onChange(key);
                }
              }}
            >
              <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
                <Icon color={isActive ? colors.glow : colors.textMuted} size={21} />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 24, 28, 0.92)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.borderTopHighlight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...glassShadow,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  iconWrapper: {
    width: 42,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: colors.glowMuted,
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    color: colors.textMuted,
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.glow,
  },
});
