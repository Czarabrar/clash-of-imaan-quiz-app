/**
 * @format
 *
 * IMPORTANT: The FCM background message handler MUST be registered
 * before AppRegistry.registerComponent — this is a react-native-firebase requirement.
 */

import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/**
 * Handle FCM messages received while the app is in the background or quit.
 * Keep this handler fast and non-blocking — do not interact with UI here.
 * Cloud Functions are responsible for sending push; this just logs/handles receipt.
 */
messaging().setBackgroundMessageHandler(async remoteMessage => {
    // Do NOT send any push from here — only handle incoming messages.
});

AppRegistry.registerComponent(appName, () => App);
