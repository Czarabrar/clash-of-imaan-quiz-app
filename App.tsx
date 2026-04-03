import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox } from 'react-native';

// Suppress non-critical warnings that trigger on first open
LogBox.ignoreLogs([
  'new NativeEventEmitter',
  'Require cycle',
  'Non-serializable values',
  'ViewPropTypes',
  'AsyncStorage',
]);
import AppNavigator from './src/navigation/AppNavigator';
import { OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Initialize OneSignal here (before any context) to avoid circular imports
    OneSignal.initialize(ONESIGNAL_APP_ID);

    // Show real system notification banner even when app is in the foreground
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      event.preventDefault();
      event.notification.display();
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
