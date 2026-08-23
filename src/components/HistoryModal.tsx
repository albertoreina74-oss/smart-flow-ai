import React from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MODE_LABELS } from '../constants/prompts';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';
import { HistoryEntry } from '../services/storageService';
import { AppModal } from './Modal';

type HistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
};

const MAX_LIST_HEIGHT = Dimensions.get('window').height * 0.55;

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryModal({ visible, onClose, entries, onSelectEntry }: HistoryModalProps) {
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Storico</Text>
      {entries.length === 0 ? (
        <Text style={styles.emptyText}>Nessuna rielaborazione salvata finora.</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: MAX_LIST_HEIGHT }}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => onSelectEntry(item)}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemMode}>{MODE_LABELS[item.mode]}</Text>
                <Text style={styles.itemDate}>{formatTimestamp(item.createdAt)}</Text>
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
