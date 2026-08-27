import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { TranslateScreen } from './src/screens/TranslateScreen';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { TabBar, TabKey } from './src/components/TabBar';
import { IncomingImport, useIncomingShareIntent } from './src/hooks/useIncomingShareIntent';
import { HistoryEntry } from './src/services/storageService';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pendingImport, setPendingImport] = useState<IncomingImport | null>(null);
  const [pendingEntry, setPendingEntry] = useState<HistoryEntry | null>(null);

  const handleIncomingImport = useCallback((payload: IncomingImport) => {
    setActiveTab('home');
    setPendingImport(payload);
  }, []);

  // Reopening an archived result hands it to Flow, where it gets the same
  // actions a fresh result has. Switching tabs remounts HomeScreen, so the
  // entry travels as pending state and is applied once it's up.
  const handleOpenEntry = useCallback((entry: HistoryEntry) => {
    setActiveTab('home');
    setPendingEntry(entry);
  }, []);

  useIncomingShareIntent({ onImport: handleIncomingImport });

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <View style={styles.content}>
          {activeTab === 'home' && (
            <HomeScreen
              pendingImport={pendingImport}
              onPendingImportHandled={() => setPendingImport(null)}
              pendingEntry={pendingEntry}
              onPendingEntryHandled={() => setPendingEntry(null)}
            />
          )}
          {activeTab === 'documents' && <DocumentsScreen />}
          {activeTab === 'translate' && <TranslateScreen />}
          {activeTab === 'archive' && <ArchiveScreen onOpenEntry={handleOpenEntry} />}
        </View>
        <View style={styles.tabBarContainer}>
          <TabBar activeTab={activeTab} onChange={setActiveTab} />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
