/**
 * Notification Service — FCM device setup + OneSignal push sending
 */
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import firestore, { doc, updateDoc } from '@react-native-firebase/firestore';

// Load keys from ignored file
import { ONESIGNAL_APP_ID_KEY, ONESIGNAL_REST_API_KEY_SECRET } from '../config/keys';

export const ONESIGNAL_APP_ID = ONESIGNAL_APP_ID_KEY;
const ONESIGNAL_REST_API_KEY = ONESIGNAL_REST_API_KEY_SECRET;

export const NOTIFICATION_TYPES = {
    CHALLENGE_INVITE: 'CHALLENGE_INVITE',
    DAILY_QUIZ: 'DAILY_QUIZ',
    MARATHON_UPDATE: 'MARATHON_UPDATE',
};

/**
 * Call this on login — saves the OneSignal subscription ID to Firestore
 * so other users can send this user a targeted push notification.
 */
/**
 * Fetch the OneSignal subscription ID for a user by their external_id (Firebase UID)
 * via the REST API, then store it in Firestore.
 * Call this after OneSignal.login(uid).
 */
export async function saveOneSignalSubscriptionId(uid) {
    try {
        const res = await fetch(
            `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${uid}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const json = await res.json();
        const subs = json?.subscriptions || [];

        // Get the active push subscription — must be enabled
        const pushSub = subs.find(s =>
            s.type === 'AndroidPush' && s.enabled === true
        );

        if (pushSub?.id) {
            const userRef = doc(firestore(), 'users', uid);
            await updateDoc(userRef, {
                oneSignalPlayerId: pushSub.id,
            });
            return true; // Success
        } else {
            // If no enabled sub found, log what we have
            const anySub = subs.find(s => s.type === 'AndroidPush');
            if (__DEV__) console.warn('[OneSignal] ❌ No ENABLED push sub. Found:', anySub ? `id=${anySub.id}, enabled=${anySub.enabled}` : 'none');
            return false; // No subscription found
        }
    } catch (e) {
        if (__DEV__) console.warn('[OneSignal] save failed:', e);
        throw e; // Re-throw for retry mechanism
    }
}

/**
 * Send push notification to a user via their OneSignal subscription ID.
 */
export async function sendPushToUser(targetUid, title, body, data = {}) {
    try {
        if (!targetUid) {
            return;
        }

        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [targetUid],
            headings: { en: title },
            contents: { en: body },
            data,
            priority: 10,
            android_visibility: 1,
            ttl: data.ttl || 3600, // Default 1 hour TTL
        };

        if (data.sendAfter) {
            payload.send_after = data.sendAfter;
        }

        const res = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (json.errors) {
            if (__DEV__) console.error('[OneSignal] ❌ Send error:', json.errors);
        }
    } catch (err) {
        if (__DEV__) console.error('[OneSignal] Error:', err);
    }
}

export async function sendPushToUsers(targetUids = [], title, body, data = {}) {
    const uniqueIds = [...new Set((targetUids || []).filter(Boolean))];
    if (!uniqueIds.length) return;

    try {
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: uniqueIds,
            headings: { en: title },
            contents: { en: body },
            data,
            priority: 10,
            android_visibility: 1,
            ttl: data.ttl || 3600,
        };

        if (data.sendAfter) {
            payload.send_after = data.sendAfter;
        }

        const res = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (__DEV__ && json?.errors) {
            console.error('[OneSignal] broadcast error:', json.errors);
        }
    } catch (err) {
        if (__DEV__) console.error('[OneSignal] broadcast failed:', err);
    }
}


export const notificationService = {
    /**
     * Request notification permission (Android 13+)
     */
    requestPermission: async () => {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        // For iOS
        const authStatus = await messaging().requestPermission();
        return (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
        );
    },

    /**
     * Get FCM token for this device
     */
    getToken: async () => {
        try {
            const token = await messaging().getToken();
            return token;
        } catch (error) {
            return null;
        }
    },

    /**
     * Listen for foreground notifications
     */
    onForegroundMessage: (callback) => {
        return messaging().onMessage(async remoteMessage => {
            if (callback) {
                callback(remoteMessage);
            } else {
                // Default: show alert
                Alert.alert(
                    remoteMessage.notification?.title || 'Notification',
                    remoteMessage.notification?.body || '',
                );
            }
        });
    },

    /**
     * Setup background message handler
     * Call this in index.js BEFORE AppRegistry.registerComponent
     */
    setBackgroundHandler: () => {
        messaging().setBackgroundMessageHandler(async remoteMessage => {
        });
    },

    /**
     * Handle notification when app is opened from quit state
     */
    getInitialNotification: async () => {
        const remoteMessage = await messaging().getInitialNotification();
        return remoteMessage;
    },

    /**
     * Listen for when notification is tapped while app is in background
     */
    onNotificationOpenedApp: (callback) => {
        return messaging().onNotificationOpenedApp(remoteMessage => {
            if (callback) {
                callback(remoteMessage);
            }
        });
    },
};
