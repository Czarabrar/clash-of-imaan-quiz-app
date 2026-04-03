/**
 * Clash of Imaan — Firebase Services
 *
 * All Firestore + Auth interactions go here.
 * Import from screens/components as needed.
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPushToUser, sendPushToUsers } from './notificationService';
import { incRead, incWrite } from './firestoreMeter';

const QUIZ_CACHE_KEY = 'home_quizzes_cache';
const USERS_CACHE_KEY = 'users_cache';
const CACHE_TTL_MS = 1000 * 60 * 10;
// Window allowed for opponent to accept a challenge. Use 60s per spec.
export const CHALLENGE_ACCEPT_WINDOW_MS = 60 * 1000; // 60 seconds
export const MATCH_DURATION_MS = 3 * 60 * 1000;
export const OPPONENT_OFFLINE_MS = 180 * 1000;

async function getCachedValue(cacheKey) {
    try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.timestamp || (Date.now() - parsed.timestamp) > CACHE_TTL_MS) {
            return null;
        }
        return parsed.value;
    } catch {
        return null;
    }
}

async function setCachedValue(cacheKey, value) {
    try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            value,
        }));
    } catch {
        // ignore cache errors
    }
}

function computeAnswerStats(answers = []) {
    const correct = answers.filter(answer => answer?.isCorrect).length;
    const time = answers.reduce((sum, answer) => sum + (typeof answer?.responseTime === 'number' ? answer.responseTime : 0), 0);
    const hadAction = Array.isArray(answers) && answers.some(a => a && (typeof a.selectedIndex === 'number' || a.isCorrect === true));
    return {
        correct,
        // If user didn't act, set a very large time so time tiebreak never favors a non-actor
        time: hadAction ? time : Number.MAX_SAFE_INTEGER,
        hadAction,
    };
}

function computeAnswerStatsUsingQuestions(answers = [], questions = []) {
    const questionMap = new Map();
    (questions || []).forEach(question => {
        if (question?.id != null) {
            questionMap.set(question.id, question);
        }
    });

    let correct = 0;
    let time = 0;
    let hadAction = false;

    for (const answer of (answers || [])) {
        if (!answer) continue;

        const selectedIndex = typeof answer.selectedIndex === 'number' ? answer.selectedIndex : null;
        const question = answer.questionId != null ? questionMap.get(answer.questionId) : null;

        let isCorrect = false;
        if (typeof answer.isCorrect === 'boolean') {
            isCorrect = answer.isCorrect;
        } else if (selectedIndex !== null && question && typeof question.correctIndex === 'number') {
            isCorrect = selectedIndex === question.correctIndex;
        }

        if (isCorrect) correct += 1;
        time += typeof answer.responseTime === 'number' ? answer.responseTime : 0;
        if (!hadAction && (selectedIndex !== null || isCorrect)) {
            hadAction = true;
        }
    }

    return {
        correct,
        time: hadAction ? time : Number.MAX_SAFE_INTEGER,
        hadAction,
    };
}

function decideWinnerFromStats(challengerId, challengerStats, opponentId, opponentStats) {
    // If one acted and the other didn't, the actor wins
    if (challengerStats.hadAction && !opponentStats.hadAction) return challengerId;
    if (opponentStats.hadAction && !challengerStats.hadAction) return opponentId;

    // Neither acted -> tie
    if (!challengerStats.hadAction && !opponentStats.hadAction) return 'tie';

    // Prioritize higher correct count
    if ((challengerStats.correct || 0) > (opponentStats.correct || 0)) return challengerId;
    if ((opponentStats.correct || 0) > (challengerStats.correct || 0)) return opponentId;

    // If correct counts are equal, use lesser total time as tiebreaker
    if ((challengerStats.time || 0) < (opponentStats.time || 0)) return challengerId;
    if ((opponentStats.time || 0) < (challengerStats.time || 0)) return opponentId;

    return 'tie';
}


/**
 * Atomically settle a match inside a Firestore transaction.
 * This is the SINGLE AUTHORITATIVE place that determines the winner.
 *
 * Result Locking: If challenge.status is already 'completed'/'timeout_win'/'expired',
 * the existing result is returned immediately — no duplicate writes.
 *
 * Timing guard: Settlement only proceeds when:
 *   (a) both players have submitted answers, OR
 *   (b) match duration has elapsed (time expired), OR
 *   (c) forceSettle is true (opponent went offline / unavailable).
 *
 * Cost: 3 reads (challenge + 2 responses) + 1 write (challenge update).
 */
async function settleMatchTransaction(challengeId, { forceSettle = false } = {}) {
    const challengeRef = firestore().collection('challenges').doc(challengeId);

    incRead(3);
    incWrite(1);
    return firestore().runTransaction(async (tx) => {
        const challengeSnap = await tx.get(challengeRef);
        if (!challengeSnap.exists) return null;
        const challenge = challengeSnap.data();

        // ── RESULT LOCKING ────────────────────────────────────────────────
        // If already settled, return existing result — prevents duplicate writes.
        if (challenge.status === 'completed' || challenge.status === 'timeout_win' || challenge.status === 'expired') {
            return { status: challenge.status, winnerId: challenge.winnerId };
        }

        if (!challenge || (challenge.status !== 'active' && challenge.status !== 'pending')) return null;

        const challengerId = challenge.challengerId;
        const opponentId = challenge.opponentId;

        const resChSnap = await tx.get(firestore().collection('challengeResponses').doc(`${challengeId}_${challengerId}`));
        const resOpSnap = await tx.get(firestore().collection('challengeResponses').doc(`${challengeId}_${opponentId}`));

        const challengerStats = computeAnswerStatsUsingQuestions(resChSnap.data()?.answers || [], challenge.questions || []);
        const opponentStats = computeAnswerStatsUsingQuestions(resOpSnap.data()?.answers || [], challenge.questions || []);

        const bothSubmitted = challengerStats.hadAction && opponentStats.hadAction;

        // ── TIMING GUARD ──────────────────────────────────────────────────
        // Check whether match duration has elapsed.
        const startMs = challenge.startTimeMs || challenge.startTime?.toMillis?.() || 0;
        const durationMs = challenge.challengeDurationMs || MATCH_DURATION_MS;
        const timeExpired = startMs > 0 && Date.now() >= (startMs + durationMs);

        // Only settle when: both submitted, time expired, or forced (opponent unavailable).
        if (!bothSubmitted && !timeExpired && !forceSettle) {
            return null; // Not ready to settle yet
        }

        // ── WINNER DECISION ───────────────────────────────────────────────
        const winnerId = decideWinnerFromStats(challengerId, challengerStats, opponentId, opponentStats);

        // Determine appropriate status and reason
        let status = 'completed';
        let completionReason = 'completed';

        if (!challengerStats.hadAction && !opponentStats.hadAction) {
            status = 'expired';
            completionReason = 'no_participants';
        } else if (!challengerStats.hadAction || !opponentStats.hadAction) {
            status = 'timeout_win';
            // opponent_unavailable: forced by offline-detection (time not yet expired)
            // opponent_timeout: forced because match timer ran out
            completionReason = (forceSettle && !timeExpired) ? 'opponent_unavailable' : 'opponent_timeout';
        } else if (winnerId === 'tie') {
            completionReason = 'tie';
        }

        if (__DEV__) {
            console.log('settleMatchTransaction: settled', {
                challengeId,
                challengerId,
                opponentId,
                challengerStats,
                opponentStats,
                winnerId,
                status,
                completionReason,
            });
        }

        tx.update(challengeRef, {
            winnerId,
            completionReason,
            status,
            endTime: firestore.FieldValue.serverTimestamp(),
            lastActionAt: firestore.FieldValue.serverTimestamp(),
        });

        return { status, winnerId };
    });
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {
    /**
     * Register a new user: creates Firebase Auth account, sets displayName,
     * then creates the Firestore user document.
     */
    signUp: async (email, password, name) => {
        const userCredential = await auth().createUserWithEmailAndPassword(email, password);
        const { user } = userCredential;

        // Set display name immediately so AuthContext can read it
        await user.updateProfile({ displayName: name });

        const uid = user.uid;
        await firestore().collection('users').doc(uid).set({
            name,
            email,
            role: 'user',
            currentStreak: 0,
            lastAnsweredDate: '',
            totalOverallPoints: 0,
            matchesPlayed: 0,
            challengesWon: 0,
            fcmToken: '',
            isOnline: false,
            lastActive: firestore.FieldValue.serverTimestamp(),
            createdAt: firestore.FieldValue.serverTimestamp(),
        });

        return userCredential;
    },

    signIn: async (email, password) => {
        return auth().signInWithEmailAndPassword(email, password);
    },

    signOut: async () => {
        return auth().signOut();
    },

    getCurrentUser: () => {
        return auth().currentUser;
    },

    onAuthStateChanged: (callback) => {
        return auth().onAuthStateChanged(callback);
    },
};

// ─── Firestore Service ────────────────────────────────────────────────────────

export const firestoreService = {
    // ── Users ──────────────────────────────────────────────────────────────────

    /**
     * Fetch a single user by uid.
     */
    getUser: async (uid) => {
        const doc = await firestore().collection('users').doc(uid).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    getAllUsers: async () => {
        const cachedUsers = await getCachedValue(USERS_CACHE_KEY);
        if (cachedUsers?.length) {
            return cachedUsers;
        }

        const snapshot = await firestore().collection('users').get();
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await setCachedValue(USERS_CACHE_KEY, users);
        return users;
    },

    updateUser: async (uid, data) => {
        return firestore().collection('users').doc(uid).update(data);
    },

    /**
     * Idempotent: create user doc only if it does not already exist.
     * Called by AuthContext automatically — exposed here for direct use if needed.
     */
    ensureUserDocument: async (uid, firebaseUser) => {
        const userRef = firestore().collection('users').doc(uid);
        const snap = await userRef.get();
        if (!snap.exists) {
            await userRef.set({
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
                lastActive: firestore.FieldValue.serverTimestamp(),
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
        }
        return (await userRef.get()).data();
    },

    /**
     * Save / update the FCM token for a user.
     */
    saveFcmToken: async (uid, token) => {
        if (!token) return;
        return firestore().collection('users').doc(uid).update({ fcmToken: token });
    },

    // ── Server Time ────────────────────────────────────────────────────────────

    /**
     * Fetch current server time from Firestore.
     * Writes serverTimestamp then reads it back.
     * Returns a JS Date.
     */
    getServerTime: async () => {
        const ref = firestore().collection('meta').doc('serverTime');
        // write then read -> 1 write + 1 read
        await ref.set({ now: firestore.FieldValue.serverTimestamp() });
        incWrite(1);
        const snap = await ref.get();
        incRead(1);
        return snap.data()?.now?.toDate?.() || new Date();
    },

    // ── Quizzes ────────────────────────────────────────────────────────────────

    getTodayQuiz: async (dayNumber) => {
        const snapshot = await firestore()
            .collection('quizzes')
            .where('dayNumber', '==', dayNumber)
            .limit(1)
            .get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    },

    getAllQuizzes: async () => {
        // Bypass caching for quizzes so schedule/unlock changes propagate immediately.
        const snapshot = await firestore()
            .collection('quizzes')
            .orderBy('unlockTime', 'desc')
            .limit(3)
            .get();
        const quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return quizzes;
    },

    /**
     * Query quizzes that are unlocked at or before the provided server time (ms).
     * This reduces client-side filtering and minimizes reads by returning only live quizzes.
     */
    getUnlockedQuizzes: async (serverNowMillis, limit = 3) => {
        try {
            if (!serverNowMillis) serverNowMillis = Date.now();
            const ts = firestore.Timestamp.fromMillis(serverNowMillis);
            const snapshot = await firestore()
                .collection('quizzes')
                .where('unlockTime', '<=', ts)
                .orderBy('unlockTime', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            if (__DEV__) console.warn('getUnlockedQuizzes failed, falling back to getAllQuizzes', e);
            return await firestoreService.getAllQuizzes();
        }
    },

    // ── Quiz Responses ─────────────────────────────────────────────────────────

    submitQuizResponse: async (userId, quizId, selectedIndex, correctIndex, responseTime, todayDateString) => {
        // 1. Check if already answered
        const snapshot = await firestore()
            .collection('quizResponses')
            .where('quizId', '==', quizId)
            .where('userId', '==', userId)
            .get();

        if (!snapshot.empty) {
            throw new Error("Already answered");
        }

        const isCorrect = selectedIndex === correctIndex;
        const userRef = firestore().collection('users').doc(userId);

        const result = await firestore().runTransaction(async (transaction) => {

            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data() || {};

            const lastAnsweredDate = userData.lastAnsweredDate || '';
            const yesterday = new Date(Date.now() - 86400000)
                .toISOString()
                .split('T')[0];

            let newStreak = 1;
            if (lastAnsweredDate === todayDateString) {
                newStreak = userData.currentStreak || 1;
            } else if (lastAnsweredDate === yesterday) {
                newStreak = (userData.currentStreak || 0) + 1;
            }

            const responseRef = firestore()
                .collection('quizResponses')
                .doc();

            transaction.set(responseRef, {
                quizId: quizId,
                userId: userId,
                selectedIndex: selectedIndex,
                isCorrect: isCorrect,
                submittedAt: firestore.FieldValue.serverTimestamp(),
            });

            transaction.update(userRef, {
                lastAnsweredDate: todayDateString,
                currentStreak: newStreak,
            });

            return { streak: newStreak };
        });

        return result;
    },

    getUserQuizResponse: async (userId, quizId) => {
        const snapshot = await firestore()
            .collection('quizResponses')
            .where('quizId', '==', quizId)
            .where('userId', '==', userId)
            .get();
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    },

    getUserQuizResponsesBatch: async (userId, quizIds = []) => {
        if (!userId || quizIds.length === 0) return {};

        const snapshot = await firestore()
            .collection('quizResponses')
            .where('userId', '==', userId)
            .where('quizId', 'in', quizIds.slice(0, 10))
            .get();

        const responses = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            responses[data.quizId] = {
                selectedIndex: data.selectedIndex,
                isCorrect: data.isCorrect,
                responseTime: data.responseTime,
            };
        });

        return responses;
    },

    getQuizLeaderboard: async (quizId) => {
        const snapshot = await firestore()
            .collection('quizResponses')
            .where('quizId', '==', quizId)
            .where('isCorrect', '==', true)
            .orderBy('submittedAt', 'asc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // ── Overall Leaderboard ────────────────────────────────────────────────────

    getOverallLeaderboard: async () => {
        const snapshot = await firestore()
            .collection('users')
            .orderBy('totalOverallPoints', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // ── Challenges ─────────────────────────────────────────────────────────────

    createChallenge: async (challengerId, opponentId, questionIds) => {
        // Prevent duplicate pending challenges for the same challenger/opponent pair.
        const existing = await firestore()
            .collection('challenges')
            .where('challengerId', '==', challengerId)
            .where('opponentId', '==', opponentId)
            .where('status', '==', 'pending')
            .limit(1)
            .get();
        incRead(1);

        if (!existing.empty) {
            const doc = existing.docs[0];
            await doc.ref.update({
                questionIds,
                // Use a server-side renewal timestamp so expiry is computed from server time
                renewedAt: firestore.FieldValue.serverTimestamp(),
                lastActionAt: firestore.FieldValue.serverTimestamp(),
            });
            return doc.ref;
        }

        incWrite(1);
        // Rely on server timestamps for timing: set `createdAt` and `renewedAt` server-side.
        // Clients should compute expiry using `renewedAt` (or `createdAt`) + window.
        return firestore().collection('challenges').add({
            challengerId,
            opponentId,
            questionIds,
            status: 'pending',
            createdAt: firestore.FieldValue.serverTimestamp(),
            renewedAt: firestore.FieldValue.serverTimestamp(),
            challengeDurationMs: MATCH_DURATION_MS,
            startTime: null,
            endTime: null,
            winnerId: null,
            completionReason: null,
            lastActionAt: firestore.FieldValue.serverTimestamp(),
        });
    },

    acceptChallenge: async (challengeId) => {
        const docRef = firestore().collection('challenges').doc(challengeId);
        try {
            return await firestore().runTransaction(async (tx) => {
                // transaction will read 1 doc
                incRead(1);
                const snap = await tx.get(docRef);
                if (!snap.exists) throw new Error('challenge-not-found');
                const data = snap.data();

                // If the challenge is already active (e.g., challenger started early), do not overwrite startTime
                if (data.status === 'active' && (data.startTimeMs || data.startTime)) {
                    // Just ensure status remains active and bump lastActionAt
                    tx.update(docRef, { status: 'active', lastActionAt: firestore.FieldValue.serverTimestamp() });
                    return { updated: false };
                }

                const now = firestore.Timestamp.now();
                // transaction will write 1 doc
                incWrite(1);
                tx.update(docRef, {
                    status: 'active',
                    startTime: now,
                    startTimeMs: now.toMillis(),
                    lastActionAt: firestore.FieldValue.serverTimestamp(),
                });
                return { updated: true, startTimeMs: now.toMillis() };
            });
        } catch (e) {
            if (__DEV__) console.warn('acceptChallenge transaction failed', e);
            throw e;
        }
    },

    /**
     * If the challenger starts the quiz before opponent accepts, mark the
     * challenge as active and set the start time. This is idempotent.
     */
    startChallengeIfPending: async (challengeId) => {
        const docRef = firestore().collection('challenges').doc(challengeId);
        const snap = await docRef.get();
        incRead(1);
        if (!snap.exists) return;
        const data = snap.data();
        if (data.status === 'active') return;
        if (data.status !== 'pending') return;

        const now = firestore.Timestamp.now();
        incWrite(1);
        return docRef.update({
            status: 'active',
            startTime: now,
            startTimeMs: now.toMillis(),
            lastActionAt: firestore.FieldValue.serverTimestamp(),
        });
    },

    expireChallenge: async (challengeId) => {
        // Expire a challenge. Behavior differs depending on challenge state.
        const snap = await firestore().collection('challenges').doc(challengeId).get();
        incRead(1);
        if (!snap.exists) return;
        const data = snap.data();
        const challengerId = data?.challengerId || null;

        if (data.status === 'pending') {
            // Award challenger by default when nobody accepted in time
            incWrite(1);
            await firestore().collection('challenges').doc(challengeId).update({
                status: 'expired',
                winnerId: challengerId,
                completionReason: 'opponent_not_responded',
                endTime: firestore.FieldValue.serverTimestamp(),
                lastActionAt: firestore.FieldValue.serverTimestamp(),
            });
            return;
        }

        if (data.status === 'active') {
            // Delegate to the single authoritative transaction (forceSettle
            // because the expiry caller has already verified conditions).
            try {
                await settleMatchTransaction(challengeId, { forceSettle: true });
            } catch (e) {
                if (__DEV__) console.warn('expireChallenge settleMatchTransaction failed', e);
            }
            return;
        }

        // Fallback: mark expired and award challenger
        await firestore().collection('challenges').doc(challengeId).update({
            status: 'expired',
            winnerId: challengerId,
            completionReason: 'opponent_not_responded',
            endTime: firestore.FieldValue.serverTimestamp(),
            lastActionAt: firestore.FieldValue.serverTimestamp(),
        });
    },

    completeChallengeForUnavailableOpponent: async (challengeId, winnerId) => {
        // Delegate to the single authoritative transaction with forceSettle
        // so it settles even if match time hasn't technically expired.
        try {
            await settleMatchTransaction(challengeId, { forceSettle: true });
        } catch (e) {
            if (__DEV__) console.warn('completeChallengeForUnavailableOpponent error:', e);
        }
    },

    submitChallengeResponse: async (challengeId, userId, answers, totalQuestions = 10) => {
        // Ensure the client is authenticated and matches the requested userId
        const currentUid = auth().currentUser?.uid;
        if (!currentUid) {
            throw new Error('not-authenticated: client has no Firebase auth token');
        }
        if (currentUid !== userId) {
            throw new Error('invalid-user: request auth uid does not match provided userId');
        }

        const docRef = firestore()
            .collection('challengeResponses')
            .doc(`${challengeId}_${userId}`);

        try {
            incWrite(1);
            await docRef.set({
                challengeId,
                userId,
                answers: answers || [],
                submittedAt: firestore.FieldValue.serverTimestamp(),
                updatedAt: firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        } catch (err) {
            if (err && err.code === 'permission-denied') {
                throw new Error('permission-denied: cannot write challenge response (check auth/Firestore rules)');
            }
            throw err;
        }

        // Bump lastActionAt on the challenge doc
        incWrite(1);
        await firestore().collection('challenges').doc(challengeId).set({
            lastActionAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Attempt atomic settlement via the single authoritative transaction.
        // This will only succeed if both players have submitted OR time has expired.
        // If not ready yet, it returns null and the client waits for the snapshot.
        try {
            const result = await settleMatchTransaction(challengeId);
            if (result?.status) {
                return { status: result.status, winnerId: result.winnerId };
            }
        } catch (e) {
            if (__DEV__) console.warn('submitChallengeResponse: settleMatchTransaction failed', e);
        }

        // Not yet settled — client will receive the result via onSnapshot listener.
        return { status: 'waiting' };
    },

    getUserChallenges: async (userId) => {
        const sent = await firestore()
            .collection('challenges')
            .where('challengerId', '==', userId)
            .orderBy('startTime', 'desc')
            .get();
        const received = await firestore()
            .collection('challenges')
            .where('opponentId', '==', userId)
            .orderBy('startTime', 'desc')
            .get();
        const all = [
            ...sent.docs.map(d => ({ id: d.id, ...d.data() })),
            ...received.docs.map(d => ({ id: d.id, ...d.data() })),
        ];
        return all.sort(
            (a, b) =>
                (b.startTime?.toMillis?.() || 0) -
                (a.startTime?.toMillis?.() || 0),
        );
    },

    /**
     * Settle a match after the timer expires.
     *
     * `force: true`  — called by the client-side timer at t=0. The timer is already
     *                  server-time-synchronized, so no extra time check is needed.
     *                  This bypasses `getServerTime()`, which requires admin write
     *                  access to meta/ and would silently fail for normal users.
     *
     * `force: false` — called from ArenaScreen cleanup. Uses local time as a guard.
     */
    finalizeMatchTimeout: async (challengeId, { force = false } = {}) => {
        try {
            // Quick pre-check: skip if already settled (avoids unnecessary transaction)
            const challengeDoc = await firestore().collection('challenges').doc(challengeId).get();
            incRead(1);
            if (!challengeDoc.exists) return;
            const challenge = challengeDoc.data();
            if (challenge.status !== 'active') return;

            // Only a participant may finalize
            const currentUid = auth().currentUser?.uid;
            if (!currentUid) return;
            if (currentUid !== challenge.challengerId && currentUid !== challenge.opponentId) return;

            if (!force) {
                // Non-forced path (ArenaScreen cleanup): verify locally that match duration
                // has elapsed before settling. No getServerTime() — it requires admin write
                // access to meta/ and throws permission-denied for normal users.
                const startMs = challenge.startTimeMs || challenge.startTime?.toMillis?.() || 0;
                if (!startMs) return;
                const durationMs = challenge.challengeDurationMs || MATCH_DURATION_MS;
                if (Date.now() < startMs + durationMs - 5000) return; // 5s early grace
            }

            // Delegate entirely to the single authoritative transaction.
            // forceSettle: true so the transaction does not block on bothSubmitted or timeExpired.
            await settleMatchTransaction(challengeId, { forceSettle: true });
        } catch (e) {
            if (e && e.code === 'permission-denied') {
                if (__DEV__) console.warn('finalizeMatchTimeout permission-denied:', e.message || e);
                return;
            }
            if (__DEV__) console.warn('finalizeMatchTimeout error:', e);
        }
    },

    markUserPresence: async (uid, isOnline) => {
        if (!uid) return;
        await firestore().collection('users').doc(uid).set({
            isOnline,
            lastActive: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    },

    runStorageCleanup: async () => {
        const [pendingChallenges, activeChallenges] = await Promise.all([
            firestore().collection('challenges').where('status', '==', 'pending').get(),
            firestore().collection('challenges').where('status', '==', 'active').get(),
        ]);

        let expiredChallenges = 0;
        let settledMatches = 0;

        for (const doc of pendingChallenges.docs) {
            const data = doc.data();
            const createdAt = data.createdAt?.toMillis?.() || 0;
            if (createdAt && Date.now() - createdAt >= CHALLENGE_ACCEPT_WINDOW_MS) {
                await firestore().collection('challenges').doc(doc.id).update({
                    status: 'expired',
                    completionReason: 'challenge_expired',
                    endTime: firestore.FieldValue.serverTimestamp(),
                    lastActionAt: firestore.FieldValue.serverTimestamp(),
                });
                expiredChallenges += 1;
            }
        }

        for (const doc of activeChallenges.docs) {
            const data = doc.data();
            const startTime = data.startTime?.toMillis?.() || 0;
            if (startTime && Date.now() - startTime >= MATCH_DURATION_MS) {
                await firestoreService.finalizeMatchTimeout(doc.id);
                settledMatches += 1;
            }
        }

        return { expiredChallenges, settledMatches };
    },

    /**
     * Expire active challenges where both participants have been inactive for at least `thresholdMs`.
     * Limits to challenges involving `currentUid` to avoid permission-denied when called from clients.
     */
    expireInactiveActiveChallenges: async (currentUid, thresholdMs = 60000) => {
        if (!currentUid) return 0;

        const now = Date.now();
        let expired = 0;

        // Query active challenges where current user is challenger
        const q1 = await firestore().collection('challenges')
            .where('challengerId', '==', currentUid)
            .where('status', '==', 'active')
            .get();

        // Query active challenges where current user is opponent
        const q2 = await firestore().collection('challenges')
            .where('opponentId', '==', currentUid)
            .where('status', '==', 'active')
            .get();

        const docs = [...q1.docs, ...q2.docs];

        for (const doc of docs) {
            const data = doc.data();
            const challengerId = data.challengerId;
            const opponentId = data.opponentId;

            try {
                const [cSnap, oSnap] = await Promise.all([
                    firestore().collection('users').doc(challengerId).get(),
                    firestore().collection('users').doc(opponentId).get(),
                ]);

                const cLast = cSnap.exists ? (cSnap.data().lastActive?.toMillis?.() || 0) : 0;
                const oLast = oSnap.exists ? (oSnap.data().lastActive?.toMillis?.() || 0) : 0;

                const inactiveC = cLast ? (now - cLast) >= thresholdMs : true;
                const inactiveO = oLast ? (now - oLast) >= thresholdMs : true;

                if (inactiveC && inactiveO) {
                    // Both inactive — expire via expireChallenge which handles active vs pending
                    await firestoreService.expireChallenge(doc.id).catch(() => {});
                    expired += 1;
                }
            } catch (e) {
                if (__DEV__) console.warn('expireInactiveActiveChallenges failed for', doc.id, e);
            }
        }

        return expired;
    },

    cleanupDuaCollection: async () => {
        const snapshot = await firestore().collection('duas').get();
        const batch = firestore().batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        if (!snapshot.empty) {
            await batch.commit();
        }
        return snapshot.size;
    },

    sendDailyQuizNotification: async () => {
        const users = await firestoreService.getAllUsers();
        const targetIds = users.map(userDoc => userDoc.id).filter(Boolean);
        if (!targetIds.length) return 0;

        await sendPushToUsers(targetIds, 'Daily quiz available', 'Your new daily Islamic quiz is now ready.', {
            type: 'daily_quiz',
            screen: 'Home',
        });

        return targetIds.length;
    },
    sendMarathonUpdateNotification: async (unlockTime) => {
        const users = await firestoreService.getAllUsers();
        const targetIds = users.map(userDoc => userDoc.id).filter(Boolean);
        if (!targetIds.length) return 0;

        const message = 'A new monthly challenge question will be available soon.';
        await sendPushToUsers(targetIds, 'Monthly challenge incoming', message, {
            type: 'marathon',
            screen: 'Marathon',
            unlockTime: unlockTime ? (unlockTime.toISOString ? unlockTime.toISOString() : String(unlockTime)) : null,
        });

        return targetIds.length;
    },
};
