import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { TranslateScreen } from './src/screens/TranslateScreen';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { TabBar, TabKey } from './src/components/TabBar';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <View style={styles.content}>
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'documents' && <DocumentsScreen />}
          {activeTab === 'translate' && <TranslateScreen />}
          {activeTab === 'archive' && <ArchiveScreen />}
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
