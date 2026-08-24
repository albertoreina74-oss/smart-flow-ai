import React, { useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, Star, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';
import { HistoryEntry } from '../services/storageService';
import { AppModal } from './Modal';

type HistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

const MAX_LIST_HEIGHT = Dimensions.get('window').height * 0.5;

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryModal({
  visible,
  onClose,
  entries,
  onSelectEntry,
  onDeleteEntry,
  onToggleFavorite,
}: HistoryModalProps) {
  const [query, setQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (showFavoritesOnly && !entry.isFavorite) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        entry.originalText.toLowerCase().includes(normalizedQuery) ||
        entry.generatedText.toLowerCase().includes(normalizedQuery) ||
        entry.modeLabel.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [entries, query, showFavoritesOnly]);

  const handleTabPress = (favoritesOnly: boolean) => {
    Haptics.selectionAsync();
    setShowFavoritesOnly(favoritesOnly);
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Storico</Text>

      <View style={styles.searchRow}>
        <Search color={colors.textMuted} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca nello storico..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tab, !showFavoritesOnly && styles.tabSelected]}
          onPress={() => handleTabPress(false)}
        >
          <Text style={[styles.tabLabel, !showFavoritesOnly && styles.tabLabelSelected]}>
            Tutti
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, showFavoritesOnly && styles.tabSelected]}
          onPress={() => handleTabPress(true)}
        >
          <Text style={[styles.tabLabel, showFavoritesOnly && styles.tabLabelSelected]}>
            Preferiti
          </Text>
        </Pressable>
      </View>

      {filteredEntries.length === 0 ? (
        <Text style={styles.emptyText}>
          {showFavoritesOnly
            ? 'Nessun preferito salvato.'
            : query
              ? 'Nessun risultato per questa ricerca.'
              : 'Nessuna rielaborazione salvata finora.'}
        </Text>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: MAX_LIST_HEIGHT }}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => onSelectEntry(item)}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemMode}>{item.modeLabel}</Text>
                <View style={styles.itemHeaderActions}>
                  <Text style={styles.itemDate}>{formatTimestamp(item.createdAt)}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggleFavorite(item.id);
                    }}
                  >
                    <Star
                      color={item.isFavorite ? colors.glow : colors.textMuted}
                      fill={item.isFavorite ? colors.glow : 'transparent'}
                      size={16}
                    />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onDeleteEntry(item.id);
                    }}
                  >
                    <Trash2 color={colors.danger} size={16} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.itemText} numberOfLines={2}>
                {item.generatedText}
              </Text>
            </Pressable>
          )}
        />
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  tabSelected: {
    backgroundColor: colors.glowMuted,
    borderColor: colors.glowBorder,
  },
  tabLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: '600',
  },
  tabLabelSelected: {
    color: colors.text,
  },
  emptyText: {
    color: colors.textMuted,
    ...typography.body,
    fontStyle: 'italic',
  },
  listContent: {
    gap: spacing.sm,
  },
  item: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  itemPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemMode: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemDate: {
    color: colors.textMuted,
    ...typography.caption,
  },
  itemText: {
    color: colors.text,
    ...typography.body,
  },
});
