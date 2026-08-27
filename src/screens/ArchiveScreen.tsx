import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Copy, ScanFace, Search, Star, Trash2 } from 'lucide-react-native';
import { Toast } from '../components/Toast';
import { colors, glassBorder, gradient, radius, spacing, typography } from '../constants/theme';
import { screenStyles as s } from '../constants/sharedStyles';
import { authenticateWithBiometrics } from '../services/biometricService';
import { writeClipboard } from '../services/clipboardService';
import {
  deleteHistoryEntry,
  getBiometricLockEnabled,
  getHistory,
  HistoryEntry,
  toggleFavoriteEntry,
} from '../services/storageService';

const TOAST_DURATION_MS = 1800;

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ArchiveScreenProps = {
  /** Reopens a saved result in Flow, where it can be refined or exported again. */
  onOpenEntry: (entry: HistoryEntry) => void;
};

export function ArchiveScreen({ onOpenEntry }: ArchiveScreenProps) {
  const insets = useSafeAreaInsets();
  const [isLocked, setIsLocked] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), TOAST_DURATION_MS);
  };

  const loadEntries = useCallback(() => {
    getHistory().then(setEntries);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lockEnabled = await getBiometricLockEnabled();
      if (cancelled) {
        return;
      }
      if (lockEnabled) {
        setIsLocked(true);
        setIsCheckingLock(false);
      } else {
        setIsLocked(false);
        setIsCheckingLock(false);
        loadEntries();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEntries]);

  const handleUnlock = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const authenticated = await authenticateWithBiometrics("Sblocca l'archivio di Smart Flow");
    if (authenticated) {
      setIsLocked(false);
      loadEntries();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleCopyEntry = async (entry: HistoryEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await writeClipboard(entry.generatedText);
    showToast('Copiato negli appunti');
  };

  const handleSelectEntry = (entry: HistoryEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenEntry(entry);
  };

  const handleToggleFavorite = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await toggleFavoriteEntry(id);
    setEntries(updated);
  };

  const handleDeleteEntry = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await deleteHistoryEntry(id);
    setEntries(updated);
  };

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

  if (isCheckingLock) {
    return <LinearGradient colors={gradient.background} style={s.screen} />;
  }

  if (isLocked) {
    return (
      <LinearGradient colors={gradient.background} style={s.screen}>
        <StatusBar style="light" />
        <View style={[styles.lockContainer, { paddingTop: insets.top }]}>
          <View style={styles.lockIconWrapper}>
            <ScanFace color={colors.glow} size={40} />
          </View>
          <Text style={styles.lockTitle}>Archivio protetto</Text>
          <Text style={styles.lockSubtitle}>
            Autenticati per consultare cronologia e preferiti.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.unlockButton, pressed && styles.unlockButtonPressed]}
            onPress={handleUnlock}
          >
            <ScanFace color={colors.textOnPrimary} size={18} />
            <Text style={styles.unlockButtonLabel}>Sblocca</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradient.background} style={s.screen}>
      <StatusBar style="light" />
      <View style={[s.scrollContent, styles.container, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>📁 Archivio</Text>
            <Text style={s.headerSubtitle}>Cronologia e preferiti</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Search color={colors.textMuted} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca nell'archivio..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={s.chipRow}>
          <Pressable
            style={[styles.tab, !showFavoritesOnly && styles.tabSelected]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowFavoritesOnly(false);
            }}
          >
            <Text style={[styles.tabLabel, !showFavoritesOnly && styles.tabLabelSelected]}>Tutti</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, showFavoritesOnly && styles.tabSelected]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowFavoritesOnly(true);
            }}
          >
            <Text style={[styles.tabLabel, showFavoritesOnly && styles.tabLabelSelected]}>Preferiti</Text>
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
            contentContainerStyle={styles.listContent}
            style={s.flex}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => handleSelectEntry(item)}
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemMode}>{item.modeLabel}</Text>
                  <View style={styles.itemHeaderActions}>
                    <Text style={styles.itemDate}>{formatTimestamp(item.createdAt)}</Text>
                    <Pressable hitSlop={8} onPress={() => handleCopyEntry(item)}>
                      <Copy color={colors.textMuted} size={16} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => handleToggleFavorite(item.id)}>
                      <Star
                        color={item.isFavorite ? colors.glow : colors.textMuted}
                        fill={item.isFavorite ? colors.glow : 'transparent'}
                        size={16}
                      />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => handleDeleteEntry(item.id)}>
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
        <View style={styles.tabBarSpacer} />
      </View>
      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  lockIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glowMuted,
    ...glassBorder,
    marginBottom: spacing.md,
  },
  lockTitle: {
    color: colors.text,
    ...typography.title,
  },
  lockSubtitle: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  unlockButtonPressed: {
    opacity: 0.8,
  },
  unlockButtonLabel: {
    color: colors.textOnPrimary,
    ...typography.subtitle,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    paddingVertical: spacing.sm,
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
    paddingBottom: spacing.lg,
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
  tabBarSpacer: {
    height: 96,
  },
});
