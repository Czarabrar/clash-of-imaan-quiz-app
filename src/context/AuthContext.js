/**
 * AuthContext — Global auth state, Firestore user doc, FCM token, server time
 *
 * Usage:
 *   Wrap your app with <AuthProvider> and consume via useAuth().
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
} from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { AppState, Platform, PermissionsAndroid } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import { saveOneSignalSubscriptionId, notificationService } from '../services/notificationService';
import { firestoreService } from '../services/firebaseService';

const AuthContext = createContext(null);

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Request FCM notification permission.
 * On Android < 13 permission is granted automatically.
 */
async function requestNotificationPermission() {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS — use Firebase messaging permission
    const status = await messaging().requestPermission();
    return (
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL
    );
}

/**
 * Fetch (or create) the Firestore user document.
 * Idempotent: will not overwrite an existing doc.
 */
async function ensureUserDocument(uid, firebaseUser) {
    const userRef = firestore().collection('users').doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
        const defaultProfile = {
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            role: 'user', // Robust default role
            currentStreak: 0,
            lastAnsweredDate: '',
            totalOverallPoints: 0,
            matchesPlayed: 0,
            challengesWon: 0,
            fcmToken: '',
            isOnline: false,
        };

        await userRef.set({
            ...defaultProfile,
            createdAt: firestore.FieldValue.serverTimestamp(),
        });

        return defaultProfile;
    }

    let data = snap.data();

    // Fallback if data is miraculously undefined despite snap.exists being true (or if race conditions happen)
    if (!data) {
        data = {
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            role: 'user',
            currentStreak: 0,
            lastAnsweredDate: '',
            totalOverallPoints: 0,
            matchesPlayed: 0,
            challengesWon: 0,
            fcmToken: '',
            isOnline: false,
        };
    }

    // Guarantee that even if the doc exists but is malformed/incomplete, it has a role
    if (!data.role) {
        data.role = 'user';
    }

    return data;
}

/**
 * Save / refresh the FCM token in the user's Firestore document.
 */
async function saveFcmToken(uid, token) {
    if (!token) return;
    // Delegate to firestoreService which centralizes user writes and error handling
    try {
        await firestoreService.saveFcmToken(uid, token);
    } catch (e) {
        if (__DEV__) console.warn('saveFcmToken failed:', e?.message || e);
    }
}

/**
 * Write a serverTimestamp to meta/serverTime then read it back.
 * Returns a JS Date for the server's current time.
 */
async function fetchServerTime() {
    try {
        const ref = firestore().collection('meta').doc('serverTime');
        await ref.set({ now: firestore.FieldValue.serverTimestamp() });
        const snap = await ref.get();
        return snap.data()?.now?.toDate?.() || new Date();
    } catch (e) {
        if (__DEV__) console.warn('fetchServerTime failed, falling back to device time:', e);
        return new Date();
    }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userRole, setUserRole] = useState('user');
    const [serverTimeOffset, setServerTimeOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const appStateRef = useRef(AppState.currentState);

    // Keep a ref to the token-refresh unsubscribe fn so we can clean it up
    const tokenRefreshUnsub = useRef(null);

    // Initialize OneSignal once on mount — no more import from notificationService here
    // (initialization has moved to App.tsx to avoid circular imports)
    useEffect(() => {
        // Just request permission; App.tsx calls OneSignal.initialize()
        OneSignal.Notifications.requestPermission(true);
    }, []);

    useEffect(() => {
        const appStateSubscription = AppState.addEventListener('change', async nextAppState => {
            const currentUid = auth().currentUser?.uid;
            if (!currentUid) {
                appStateRef.current = nextAppState;
                return;
            }

            if (nextAppState === 'active') {
                await firestoreService.markUserPresence(currentUid, true).catch(() => {});
            } else {
                await firestoreService.markUserPresence(currentUid, false).catch(() => {});
            }

            appStateRef.current = nextAppState;
        });

        const heartbeat = setInterval(() => {
            const currentUid = auth().currentUser?.uid;
            if (currentUid && appStateRef.current === 'active') {
                firestoreService.markUserPresence(currentUid, true).catch(() => {});
            }
        }, 60000);

        return () => {
            appStateSubscription.remove();
            clearInterval(heartbeat);
        };
    }, []);

    useEffect(() => {
        // Listen to Firebase auth state
        const unsubscribeAuth = auth().onAuthStateChanged(async (firebaseUser) => {
            // Clean up any previous token-refresh listener
            if (tokenRefreshUnsub.current) {
                tokenRefreshUnsub.current();
                tokenRefreshUnsub.current = null;
            }

            if (!firebaseUser) {
                setUser(null);
                setUserProfile(null);
                setUserRole('user');
                setLoading(false);
                return;
            }

            try {
                const uid = firebaseUser.uid;

                // 1. Ensure Firestore user doc exists
                const profile = await ensureUserDocument(uid, firebaseUser);
                setUserProfile(profile);
                setUserRole(profile.role || 'user');
                setUser(firebaseUser);
                await firestoreService.markUserPresence(uid, true);

                // 1b. Link OneSignal to this user and opt-in for push
                OneSignal.login(uid);
                OneSignal.User.pushSubscription.optIn();  // CRITICAL: subscribe for push

                // Retry saving subscription ID until it succeeds (up to 10 attempts with increasing delay)
                const saveSubscriptionWithRetry = async (attempt = 1) => {
                    try {
                        const success = await saveOneSignalSubscriptionId(uid);
                        if (success) {
                        } else if (attempt < 10) {
                            const delay = Math.min(1000 * attempt, 5000); // Max 5 second delay
                            setTimeout(() => saveSubscriptionWithRetry(attempt + 1), delay);
                        } else {
                            if (__DEV__) console.warn('[OneSignal] ❌ No subscription found after 10 attempts');
                        }
                    } catch (error) {
                        if (attempt < 10) {
                            const delay = Math.min(1000 * attempt, 5000); // Max 5 second delay
                            setTimeout(() => saveSubscriptionWithRetry(attempt + 1), delay);
                        } else {
                            if (__DEV__) console.warn('[OneSignal] ❌ Failed to save subscription after 10 attempts:', error.message);
                        }
                    }
                };

                // Start the retry process after initial delay
                setTimeout(() => saveSubscriptionWithRetry(), 2000);

                // 2. Request notification permission & reliably save FCM token (with retries)
                const permissionGranted = await requestNotificationPermission();
                if (permissionGranted) {
                    const getAndSaveTokenWithRetry = async (attempt = 1) => {
                        try {
                            const token = await notificationService.getToken();
                            if (token) {
                                await saveFcmToken(uid, token);
                                // Update profile in state as well
                                setUserProfile(prev => ({ ...prev, fcmToken: token }));

                                // Register token refresh listener once we have a token
                                tokenRefreshUnsub.current = messaging().onTokenRefresh(
                                    async (newToken) => {
                                        try {
                                            await saveFcmToken(uid, newToken);
                                            setUserProfile(prev => ({
                                                ...prev,
                                                fcmToken: newToken,
                                            }));
                                        } catch (e) {
                                            if (__DEV__) console.warn('onTokenRefresh save failed', e);
                                        }
                                    }
                                );

                                return true;
                            }
                            // If no token yet, retry a few times with backoff
                            if (attempt < 6) {
                                await new Promise(r => setTimeout(r, 300 * attempt));
                                return getAndSaveTokenWithRetry(attempt + 1);
                            }
                            if (__DEV__) console.warn('FCM token unavailable after retries');
                            return false;
                        } catch (e) {
                            if (attempt < 6) {
                                await new Promise(r => setTimeout(r, 300 * attempt));
                                return getAndSaveTokenWithRetry(attempt + 1);
                            }
                            if (__DEV__) console.warn('Failed to get/save FCM token:', e);
                            return false;
                        }
                    };

                    // Start attempts (non-blocking to avoid delaying UI too long)
                    getAndSaveTokenWithRetry().catch(e => {
                        if (__DEV__) console.warn('getAndSaveTokenWithRetry top-level error', e);
                    });
                }

                // 4. Compute server time offset
                const serverTime = await fetchServerTime();
                const offset = serverTime.getTime() - Date.now();
                setServerTimeOffset(offset);
            } catch (err) {
                if (__DEV__) console.error('AuthContext: post-login setup error:', err);
            } finally {
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (tokenRefreshUnsub.current) {
                tokenRefreshUnsub.current();
            }
        };
    }, []);

    const signOut = async () => {
        if (user?.uid) {
            await firestoreService.markUserPresence(user.uid, false).catch(() => {});
        }
        OneSignal.logout();
        await auth().signOut();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                userProfile,
                userRole,
                serverTimeOffset,
                loading,
                signOut,
            }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return ctx;
}
