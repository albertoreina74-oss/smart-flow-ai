import { Alert, Share } from 'react-native';
import { getFriendlyErrorMessage } from './geminiService';

/**
 * Shares plain text via the native share sheet (`UIActivityViewController`
 * on iOS). `Share.share` resolves — it does not reject — when the user
 * simply dismisses the sheet without picking anything, so a caught error
 * here is always a genuine failure, never a cancel.
 */
export async function shareText(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch (error) {
    Alert.alert('Condivisione non riuscita', getFriendlyErrorMessage(error));
  }
}

/**
 * Runs a file export/share action (PDF, DOCX, XLSX, CSV, TXT, print, ...)
 * and surfaces any failure as an explicit `Alert` instead of only writing
 * it to an error state that's easy to miss once the export sheet has
 * already closed.
 */
export async function runShareAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    Alert.alert('Esportazione non riuscita', getFriendlyErrorMessage(error));
  }
}
