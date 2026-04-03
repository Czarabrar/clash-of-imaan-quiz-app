/**
 * Arena Screen — 1v1 Challenge
    */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Alert,
    Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useUsersContext } from '../context/UsersContext';
import { useArena } from '../context/ArenaContext';
import { sendPushToUser } from '../services/notificationService';
import { CHALLENGE_ACCEPT_WINDOW_MS, MATCH_DURATION_MS, firestoreService } from '../services/firebaseService';

export default function ArenaScreen({ navigation }) {
    const { user, userProfile, serverTimeOffset } = useAuth();
    const { users } = useUsersContext();
    const { getRandomQuestions, loading: arenaLoading } = useArena();
    const [challenges, setChallenges] = useState([]);
    const [incomingChallenge, setIncomingChallenge] = useState(null);
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'history'
    const [history, setHistory] = useState([]);

    // Safety ref so we only auto-navigate to a unique 'active' match once per session
    const activeNavigatedRef = useRef(new Set());
    const seenExpiredRef = useRef(new Set());

    // Filter out the current user so they don't challenge themselves
    const availableOpponents = users.filter(u => u.id !== user?.uid);
    const acceptSeconds = Math.floor(CHALLENGE_ACCEPT_WINDOW_MS / 1000);

    const expirePendingChallenges = useCallback(async (docs = []) => {
        for (const challengeDoc of docs) {
            const expiresAt = challengeDoc.expiresAt?.toMillis?.()
                || ((challengeDoc.createdAt?.toMillis?.() || 0) + CHALLENGE_ACCEPT_WINDOW_MS);
            const hasExpired = challengeDoc.status === 'pending' && expiresAt && Date.now() >= expiresAt;

            if (!hasExpired) {
                continue;
            }

            try {
                await firestoreService.expireChallenge(challengeDoc.id);
            } catch {
                // ignore race conditions from multiple clients
            }

            if (!seenExpiredRef.current.has(challengeDoc.id)) {
                seenExpiredRef.current.add(challengeDoc.id);
                const isSender = challengeDoc.challengerId === user?.uid;
                Alert.alert(
                    'Challenge expired',
                    isSender ? 'Opponent did not accept within 60 seconds.' : 'This challenge request expired before it was accepted.',
                );
            }

            if (incomingChallenge?.id === challengeDoc.id) {
                setIncomingChallenge(null);
            }
        }
    }, [incomingChallenge?.id, user?.uid]);

    // Handle FCM notification taps — when user taps a challenge notification
    useEffect(() => {
        // App opened from background via notification
        const unsubOnNotif = messaging().onNotificationOpenedApp(remoteMessage => {
            if (remoteMessage?.data?.type === 'challenge') {
                // Already on Arena — the Firestore listener will show the modal
                setActiveTab('users');
            }
        });

        // App opened from KILLED state via notification
        messaging().getInitialNotification().then(remoteMessage => {
            if (remoteMessage?.data?.type === 'challenge') {
                setActiveTab('users');
            }
        });

        return () => unsubOnNotif();
    }, []);

    useEffect(() => {
        if (!user) return;

        // 1. Listen for ONLY active/pending challenges
        const sentSub = firestore()
            .collection('challenges')
            .where('challengerId', '==', user.uid)
            .where('status', 'in', ['pending', 'active', 'expired'])
            .onSnapshot(async snap => {
                if (!snap) return;
                const sent = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                await expirePendingChallenges(sent);
                setChallenges(prev => {
                    const others = prev.filter(c => c.challengerId !== user.uid);
                    return [...others, ...sent.filter(item => item.status !== 'expired')]
                        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                });
            });

        const recvSub = firestore()
            .collection('challenges')
            .where('opponentId', '==', user.uid)
            .where('status', 'in', ['pending', 'active', 'expired'])
            .onSnapshot(async snap => {
                if (!snap) return;
                const received = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                await expirePendingChallenges(received);

                // Only show the accept modal if the current user is the OPPONENT (not the challenger)
                const pending = received.find(r => r.status === 'pending' && r.opponentId === user.uid && r.challengerId !== user.uid);
                if (pending && (!incomingChallenge || incomingChallenge.id !== pending.id)) {
                    setIncomingChallenge(pending);
                } else if (!pending) {
                    setIncomingChallenge(null);
                }

                setChallenges(prev => {
                    const others = prev.filter(c => c.opponentId !== user.uid);
                    return [...others, ...received.filter(item => item.status !== 'expired')]
                        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                });
            });

        return () => {
            sentSub();
            recvSub();
        };
    }, [user, incomingChallenge, expirePendingChallenges]);

    // Periodically expire active challenges if both participants are inactive for > 60s
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const interval = setInterval(() => {
            firestoreService.expireInactiveActiveChallenges(user.uid, 60000).catch(e => {
                if (__DEV__) console.warn('expireInactiveActiveChallenges error', e);
            });
        }, 60000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [user]);

    useEffect(() => {
        if (!challenges.length) return;

        const interval = setInterval(() => {
            // Expire pending challenges that weren't accepted in time
            expirePendingChallenges(challenges.filter(challenge => challenge.status === 'pending'));

            // Expire active challenges that have exceeded the 3-minute match duration
            challenges.filter(c => c.status === 'active').forEach(challenge => {
                const startMs = challenge.startTimeMs
                    || challenge.startTime?.toMillis?.()
                    || 0;
                if (startMs && Date.now() - startMs >= MATCH_DURATION_MS + 10000) {
                    // 10 seconds grace period after match duration
                    firestoreService.finalizeMatchTimeout(challenge.id, { force: true }).catch(() => {});
                }
            });
        }, 15000); // Check every 15 seconds to reduce read load

        return () => clearInterval(interval);
    }, [challenges, expirePendingChallenges]);

    // 2. Auto-navigate to Challenge if an active match appears
    useEffect(() => {
        if (!user) return;
        const activeChallenge = challenges.find(c => c.status === 'active');
        if (!activeChallenge) return;
        if (activeNavigatedRef.current.has(activeChallenge.id)) return;

        // Compute remaining time using serverTimeOffset if available to avoid client clock drift
        const startMs = activeChallenge.startTimeMs || activeChallenge.startTime?.toMillis?.() || 0;
        const serverNowMs = Date.now() + (serverTimeOffset || 0);
        const matchEndMs = startMs + MATCH_DURATION_MS;

        // If match already expired according to server-adjusted time, try to finalize/expire it first
        if (startMs && serverNowMs >= matchEndMs) {
            // Attempt to finalize on server; do not navigate into an expired match
            activeNavigatedRef.current.add(activeChallenge.id);
            firestoreService.finalizeMatchTimeout(activeChallenge.id, { force: true }).catch(() => {});
            return;
        }

        // Otherwise it's truly active — navigate into it
        activeNavigatedRef.current.add(activeChallenge.id);
        navigation.navigate('Challenge', { challengeId: activeChallenge.id });
    }, [challenges, navigation, user]);

    // 3. Load History from AsyncStorage
    useEffect(() => {
        if (!user || activeTab !== 'history') return;
        const loadHistory = async () => {
            try {
                const stored = await AsyncStorage.getItem(`arenaHistory_${user.uid}`);
                if (stored) setHistory(JSON.parse(stored));
            } catch (e) {
                if (__DEV__) console.error("Failed to load history", e);
            }
        };
        loadHistory();
    }, [user, activeTab]);

    const handleChallenge = async (opponent) => {
        try {
            // Attempt to get random questions from Arena context. If the context is still
            // loading (first-run after sign-in) retry a few times before falling back to
            // a direct Firestore fetch.
            let questions = getRandomQuestions(10);

            if ((!questions || questions.length === 0) && arenaLoading) {
                // Retry up to 4 times with short delay while ArenaProvider populates
                let attempts = 0;
                while (( !questions || questions.length === 0) && attempts < 4) {
                    await new Promise(r => setTimeout(r, 300));
                    questions = getRandomQuestions(10);
                    attempts += 1;
                }
            }

            // Fallback: fetch arenaQuestions directly from Firestore if still empty
            if (!questions || questions.length === 0) {
                try {
                    const snap = await firestore().collection('arenaQuestions').get();
                    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    // Shuffle and take requested count
                    const shuffled = all.sort(() => 0.5 - Math.random());
                    questions = shuffled.slice(0, Math.min(10, shuffled.length));
                } catch (e) {
                    if (__DEV__) console.warn('Direct arenaQuestions fetch failed', e);
                }
            }

            if (!questions || questions.length === 0) {
                Alert.alert("Error", "Question bank is empty. Please try again later.");
                return;
            }

            // Compute a server-aligned 'now' using `serverTimeOffset` (ms).
            // This avoids device clock skew causing premature expiry.
            const nowMs = (typeof serverTimeOffset === 'number')
                ? Date.now() + serverTimeOffset
                : Date.now();

            await firestore().collection('challenges').add({
                challengerId: user.uid,
                opponentId: opponent.id,
                status: 'pending',
                createdAt: firestore.FieldValue.serverTimestamp(),
                // Write an expiresAt computed from server-aligned time so clients agree on deadline
                expiresAt: firestore.Timestamp.fromMillis(nowMs + CHALLENGE_ACCEPT_WINDOW_MS),
                challengeDurationMs: 180000,
                lastActionAt: firestore.FieldValue.serverTimestamp(),
                questions: questions,
                winnerId: null,
            });
            Alert.alert("Challenge Sent", `Waiting for ${opponent.name} to accept (60 seconds).`);

            // Send push notification to the opponent
            const myName = userProfile?.name || 'Someone';
            sendPushToUser(
                opponent.id,
                'New family quiz challenge',
                `${myName} invited you to a family quiz challenge. Open Challenge to accept.`,
                { screen: 'Arena', type: 'challenge' }
            );
        } catch (e) {
            if (__DEV__) console.error("Challenge error", e);
            Alert.alert("Error", "Could not send challenge");
        }
    };

    const handleAcceptChallenge = async () => {
        if (!incomingChallenge) return;
        try {
            if (__DEV__) console.log('Accepting challenge', incomingChallenge.id);
            const res = await firestoreService.acceptChallenge(incomingChallenge.id);
            if (__DEV__) console.log('acceptChallenge resolved', res);
            await sendPushToUser(
                incomingChallenge.challengerId,
                'Challenge accepted',
                'Your family quiz challenge was accepted. The quiz is now live.',
                { type: 'challenge_accepted', challengeId: incomingChallenge.id, screen: 'Arena' },
            );
            setIncomingChallenge(null);
        } catch (e) {
            console.error("Accept error", e);
        }
    };

    const handleRejectChallenge = async () => {
        if (!incomingChallenge) return;
        try {
            await firestore().collection('challenges').doc(incomingChallenge.id).update({
                status: 'rejected'
            });
            setIncomingChallenge(null);
        } catch (e) {
            console.error("Reject error", e);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return COLORS.success;
            case 'pending':
                return COLORS.primaryGold;
            case 'active':
                return '#4A90D9';
            default:
                return COLORS.lightBrown;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return 'check-circle-outline';
            case 'pending':
                return 'clock-outline';
            case 'active':
                return 'sword-cross';
            default:
                return 'help-circle-outline';
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Challenge Your Family</Text>

                {/* Pill Navigation */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('users')}>
                        <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('history')}>
                        <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'users' ? (
                    <>
                        {/* Active Challenges */}
                        {challenges.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>Family Challenges</Text>
                                {challenges.map(challenge => {
                                    const isSender = challenge.challengerId === user.uid;
                                    const opponentUserId = isSender ? challenge.opponentId : challenge.challengerId;
                                    const opponentUser = users.find(u => u.id === opponentUserId);
                                    const displayName = opponentUser ? opponentUser.name : "Unknown Player";

                                    return (
                                        <TouchableOpacity
                                            key={challenge.id}
                                            style={styles.challengeCard}
                                            onPress={() => {
                                                if (challenge.status === 'active') {
                                                    navigation.navigate('Challenge', { challengeId: challenge.id });
                                                }
                                            }}
                                            activeOpacity={challenge.status === 'active' ? 0.7 : 1}>
                                            <View style={styles.challengeLeft}>
                                                <View style={styles.challengeAvatar}>
                                                    <Text style={styles.challengeAvatarText}>
                                                        {displayName.charAt(0)}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={styles.challengeOpponent}>
                                                        {displayName}
                                                    </Text>
                                                    <View style={styles.statusRow}>
                                                        <Icon
                                                            name={getStatusIcon(challenge.status)}
                                                            size={14}
                                                            color={getStatusColor(challenge.status)}
                                                        />
                                                        <Text style={[styles.statusText, { color: getStatusColor(challenge.status) }]}>
                                                            {challenge.status.charAt(0).toUpperCase() + challenge.status.slice(1)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                            {challenge.status === 'active' && (
                                                <Icon name="chevron-right" size={22} color={COLORS.primaryGold} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </>
                        )}

                        <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>Available Opponents</Text>
                        <View style={styles.pickerContainer}>
                            {availableOpponents.length === 0 ? (
                                <Text style={[styles.userName, { paddingVertical: SPACING.md, textAlign: 'center' }]}>
                                    No opponents available.
                                </Text>
                            ) : (
                                availableOpponents.map(opponent => (
                                    <View key={opponent.id} style={styles.userItem}>
                                        <View style={styles.userAvatar}>
                                            <Text style={styles.avatarText}>{opponent.avatar || opponent.name.charAt(0)}</Text>
                                        </View>
                                        <Text style={styles.userName}>{opponent.name}</Text>
                                        <TouchableOpacity
                                            style={styles.directChallengeBtn}
                                            onPress={() => handleChallenge(opponent)}
                                        >
                                            <Icon name="sword-cross" size={16} color={COLORS.cardBackground} />
                                            <Text style={styles.directChallengeBtnText}>Challenge</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>
                    </>
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>Match History</Text>
                        {history.length === 0 ? (
                            <Text style={styles.emptyText}>No matches finished yet.</Text>
                        ) : (
                            history.map(record => {
                                const opponentUser = users.find(u => u.id === record.opponentId);
                                const displayName = opponentUser ? opponentUser.name : "Unknown Player";
                                const isWin = record.result === 'Won';
                                const isTie = record.result === 'Tie';
                                const resultColor = isTie ? COLORS.primaryGold : (isWin ? COLORS.success : (COLORS.error || '#D94A4A'));

                                return (
                                    <View key={record.id} style={styles.challengeCard}>
                                        <View style={styles.challengeLeft}>
                                            <View style={[styles.challengeAvatar, { backgroundColor: resultColor + '20' }]}>
                                                <Text style={[styles.challengeAvatarText, { color: resultColor }]}>
                                                    {displayName.charAt(0)}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={styles.challengeOpponent}>{displayName}</Text>
                                                <Text style={[styles.statusText, { color: resultColor, marginTop: 4 }]}>
                                                    {record.result}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </>
                )}


                {/* Incoming Challenge Modal */}
                <Modal visible={!!incomingChallenge} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Icon name="sword-cross" size={40} color={COLORS.primaryGold} />
                            <Text style={styles.modalTitle}>New Challenge!</Text>
                            <Text style={styles.modalText}>
                                {users.find(u => u.id === incomingChallenge?.challengerId)?.name || "Someone"} has challenged you to a live quiz match. This invite expires in {acceptSeconds} seconds.
                            </Text>
                            <View style={styles.modalRow}>
                                <TouchableOpacity style={[styles.modalBtn, styles.modalRejectBtn]} onPress={handleRejectChallenge}>
                                    <Text style={styles.modalBtnText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.modalAcceptBtn]} onPress={handleAcceptChallenge}>
                                    <Text style={[styles.modalBtnText, { color: COLORS.cardBackground }]}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.xl,
        paddingBottom: 100,
    },
    title: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.hero,
        color: COLORS.darkBrown,
        marginTop: SPACING.xxl,
        marginBottom: SPACING.lg,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.pill,
        padding: 4,
        marginBottom: SPACING.xl,
        ...SHADOWS.elevated,
    },
    tabButton: {
        flex: 1,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.pill,
    },
    tabButtonActive: {
        backgroundColor: COLORS.primaryGold,
    },
    tabText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
    },
    tabTextActive: {
        color: COLORS.cardBackground,
    },
    pickerContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        ...SHADOWS.card,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.beigeDark,
        gap: SPACING.md,
    },
    userAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primaryGold + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.primaryGold,
    },
    userName: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        flex: 1,
    },
    directChallengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryGold,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.pill,
        gap: 6,
    },
    directChallengeBtnText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xs,
        color: COLORS.cardBackground,
    },
    sectionTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
        marginBottom: SPACING.lg,
        letterSpacing: 0.5,
    },
    emptyText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: SPACING.xl,
    },
    challengeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.card,
    },
    challengeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        flex: 1,
    },
    challengeAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.primaryGold + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    challengeAvatarText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.primaryGold,
    },
    challengeOpponent: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    statusText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        letterSpacing: 0.5,
    },
    scoreText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.primaryGold,
        marginRight: SPACING.sm,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xxl,
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.xxl,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        width: '100%',
        ...SHADOWS.elevated,
    },
    modalTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    modalText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    modalRow: {
        flexDirection: 'row',
        gap: SPACING.lg,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.pill,
        alignItems: 'center',
    },
    modalRejectBtn: {
        backgroundColor: COLORS.beigeDark,
    },
    modalAcceptBtn: {
        backgroundColor: COLORS.primaryGold,
    },
    modalBtnText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    }
});
