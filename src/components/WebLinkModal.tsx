import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Link2, Sparkles, TriangleAlert } from 'lucide-react-native';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';
import { AppModal } from './Modal';
import { extractArticleFromUrl, ExtractedArticle } from '../services/webExtractorService';

type WebLinkModalProps = {
  visible: boolean;
  onClose: () => void;
  onExtracted: (article: ExtractedArticle) => void;
};

export function WebLinkModal({ visible, onClose, onExtracted }: WebLinkModalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    setUrl('');
    setError('');
    onClose();
  };

  const handleExtract = async () => {
    if (!url.trim() || isLoading) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    setError('');
    try {
      const article = await extractArticleFromUrl(url);
      setUrl('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onExtracted(article);
      onClose();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : 'Si è verificato un errore imprevisto.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={handleClose}>
      <View style={styles.iconWrapper}>
        <Link2 color={colors.glow} size={22} />
      </View>
      <Text style={styles.title}>Link Web</Text>
      <Text style={styles.subtitle}>
        Incolla l'indirizzo di un articolo: verrà estratto e riassunto automaticamente.
      </Text>

      <TextInput
        value={url}
        onChangeText={(value) => {
          setUrl(value);
          if (error) {
            setError('');
          }
        }}
        placeholder="https://esempio.com/articolo"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!isLoading}
        style={styles.input}
      />

      {error ? (
        <View style={styles.errorRow}>
          <TriangleAlert color={colors.danger} size={16} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (!url.trim() || isLoading || pressed) && styles.buttonDisabled,
        ]}
        onPress={handleExtract}
        disabled={!url.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Sparkles color={colors.textOnPrimary} size={18} />
        )}
        <Text style={styles.buttonLabel}>{isLoading ? 'Estrazione in corso...' : 'Estrai e Riassumi'}</Text>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glowMuted,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
    marginBottom: spacing.lg,
  },
  input: {
    color: colors.text,
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    padding: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    ...typography.caption,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: colors.textOnPrimary,
    ...typography.subtitle,
    fontWeight: '700',
  },
});
