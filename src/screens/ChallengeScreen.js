/**
 * Challenge Screen — 5-question async duel
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, ScrollView, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ViewShot from 'react-native-view-shot';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../context/UsersContext';
import { useArena } from '../context/ArenaContext';
import firestore from '@react-native-firebase/firestore';
import { firestoreService, MATCH_DURATION_MS, OPPONENT_OFFLINE_MS } from '../services/firebaseService';
import { ResultShareCard } from '../components/ResultShareCard';
import { useResultShare } from '../hooks/useResultShare';

// [Removed hardcoded CHALLENGE_QUESTIONS]

export default function ChallengeScreen({ navigation, route }) {
    const { challengeId } = route.params || {};
    const { user, serverTimeOffset } = useAuth();
    const { users } = useUsers();
    // Score calculation
    const currentScoreCount = (answers || []).filter(a => a.isCorrect).length;
    const currentTotalTimeSecs = ((answers || []).reduce((s, a) => s + a.responseTime, 0) / 1000).toFixed(1);

    const { shareRef, sharing, captureAndShare } = useResultShare();
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState([]);
    const answersRef = useRef([]);  // Always-current ref for stale-closure-safe timer callback
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    const [isFinished, setIsFinished] = useState(false);

    // Timer state
    const [timeLeft, setTimeLeft] = useState(180); // 3 minutes = 180 seconds
    const timeoutHandledRef = useRef(false);
    const [forceExpired, setForceExpired] = useState(false);

    // Live Match State
    const [matchState, setMatchState] = useState(null);
    const previousStatusRef = useRef(null);
    const unavailableHandledRef = useRef(false);

    const { arenaQuestions, getSeededQuestions } = useArena();
    const [provisionalQuestions, setProvisionalQuestions] = useState([]);
    const snapshotReceivedRef = useRef(false);

    // Seed questions locally immediately so UI can render without waiting for Firestore.
    useEffect(() => {
        try {
            const seed = challengeId || String(Date.now());
            const seeded = getSeededQuestions(seed, 10);
            setProvisionalQuestions(seeded || []);
        } catch (e) {
            setProvisionalQuestions([]);
        }
    }, [challengeId, getSeededQuestions]);

    // Prefer embedded `questions`. If absent, prefer local mapping of `questionIds`.
    // If neither is present, fall back to `provisionalQuestions` (deterministic local seed).
    let questions = [];
    if (matchState) {
        if (matchState.questions && matchState.questions.length > 0) {
            questions = matchState.questions;
        } else if (matchState.questionIds && matchState.questionIds.length > 0) {
            questions = matchState.questionIds.map(id => arenaQuestions.find(q => q.id === id)).filter(Boolean);
        } else {
            questions = provisionalQuestions;
        }
    } else {
        questions = provisionalQuestions;
    }
    const question = questions[currentQ];
    const [showReview, setShowReview] = useState(false);
    const [languageMode, setLanguageMode] = useState('both'); // 'both' | 'english' | 'roman'
    const matchCompleted = matchState?.status === 'completed';

    const saveHistory = useCallback(async (result) => {
        if (!user || !challengeId) return;
        try {
            const opponentId = matchState?.challengerId === user.uid ? matchState?.opponentId : matchState?.challengerId;
            if (!opponentId) return; // safeguard if matchState ain't loaded yet

            const raw = await AsyncStorage.getItem(`arenaHistory_${user.uid}`);
            const hist = raw ? JSON.parse(raw) : [];

            const newRecord = {
                id: challengeId,
                opponentId,
                result,
                date: new Date().toISOString()
            };

            // Push only if not duplicate
            if (!hist.find(h => h.id === challengeId)) {
                await AsyncStorage.setItem(`arenaHistory_${user.uid}`, JSON.stringify([newRecord, ...hist]));
            }
        } catch (e) { if (__DEV__) console.error("History save err", e); }
    }, [user, challengeId, matchState]);

    // Persist current answers for the review screen only. Keyed per-challenge.
    const REVIEW_CACHE_KEY = (id) => `challenge_review_${id}`;
    const saveAnswersToCache = useCallback(async (ans) => {
        if (!challengeId) return;
        try {
            await AsyncStorage.setItem(REVIEW_CACHE_KEY(challengeId), JSON.stringify({ timestamp: Date.now(), answers: ans || [] }));
        } catch (e) {
            if (__DEV__) console.warn('saveAnswersToCache failed', e);
        }
    }, [challengeId]);

    const loadAnswersFromCache = useCallback(async () => {
        if (!challengeId) return null;
        try {
            const raw = await AsyncStorage.getItem(REVIEW_CACHE_KEY(challengeId));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.answers || null;
        } catch (e) {
            if (__DEV__) console.warn('loadAnswersFromCache failed', e);
            return null;
        }
    }, [challengeId]);

    const submitAllAnswers = useCallback(async (finalAnswers) => {
        setIsFinished(true);
        if (challengeId && user) {
            try {
                const qCount = questions?.length || 0;

                // Sanitize answers: remove entries missing questionId and replace undefined
                // numeric fields with 0. Firestore rejects `undefined` values which caused
                // the "Unsupported field value: undefined" error.
                const cleaned = (finalAnswers || []).map((a, idx) => {
                    const questionId = a?.questionId || questions?.[idx]?.id || null;
                    return {
                        questionId,
                        selectedIndex: (typeof a?.selectedIndex === 'number') ? a.selectedIndex : null,
                        isCorrect: !!a?.isCorrect,
                        responseTime: typeof a?.responseTime === 'number' ? a.responseTime : 0,
                    };
                // Keep the answer if it has a valid questionId OR a valid selectedIndex.
                // Without this, answers built from questions that lack an `id` field
                // would all be filtered out, causing the challengeResponses doc to be
                // written with answers:[] and the match to settle as 'expired'.
                }).filter(a => a.questionId !== null || typeof a.selectedIndex === 'number');

                if (__DEV__ && cleaned.length !== (finalAnswers || []).length) {
                    console.warn('submitAllAnswers: dropped answers with missing questionId', { original: finalAnswers, cleaned });
                }

                // persist answers for review UI before sending
                await saveAnswersToCache(cleaned);
                const res = await firestoreService.submitChallengeResponse(challengeId, user.uid, cleaned, qCount);
                if (__DEV__) console.log('submitChallengeResponse result', res);
                // If the transaction already settled the match (both players submitted),
                // optimistically apply the result to local state immediately.
                // This ensures the last-to-submit player sees their result at the same
                // time as the winner — without waiting for onSnapshot to bounce back
                // from the server after the transaction.
                if (res?.status && res.status !== 'waiting') {
                    setMatchState(prev => prev ? { ...prev, status: res.status, winnerId: res.winnerId } : prev);
                }
            } catch (err) {
                if (__DEV__) console.error("Submit challenge err:", err);
            }
        }
    }, [challengeId, questions?.length, user]);

    const handleTimeUp = useCallback(() => {
        submitAllAnswers(answersRef.current);
    }, [submitAllAnswers]);

    // Real-time listener for match completion
    useEffect(() => {
        if (!challengeId) return;
        const unsub = firestore().collection('challenges').doc(challengeId).onSnapshot(doc => {
            snapshotReceivedRef.current = true;
            if (!doc.exists) {
                if (__DEV__) console.warn('ChallengeSnapshot: doc does not exist', challengeId);
                return;
            }

            const data = doc.data() || null;
            if (__DEV__) console.log('ChallengeSnapshot FULL', challengeId, { exists: doc.exists, data });

            // Defensive: normalize missing status / startTime. Some clients or
            // old flows may not set `status` or `startTimeMs` immediately.
            if (data) {
                const inferredStatus = data.status ?? (data.startTimeMs || data.startTime ? 'active' : 'pending');
                const safeData = { ...data, status: inferredStatus };

                // If active but missing startTimeMs, set a client-side fallback so timers run.
                if (safeData.status === 'active' && !safeData.startTimeMs && !safeData.startTime) {
                    const fallbackStartMs = Date.now() + (serverTimeOffset || 0);
                    safeData.startTimeMs = fallbackStartMs;
                }

                setMatchState(safeData);

                const status = safeData?.status;
                if ((status === 'completed' || status === 'timeout_win') && safeData.winnerId && previousStatusRef.current !== status) {
                    const iWon = safeData.winnerId === user?.uid;
                    const isTie = safeData.winnerId === 'tie';
                    saveHistory(isTie ? 'Tie' : (iWon ? 'Won' : 'Lost'));

                    if ((safeData.completionReason === 'opponent_unavailable' || safeData.completionReason === 'opponent_timeout') && iWon) {
                        Alert.alert('Opponent unavailable', 'You win by default.');
                    }
                }

                previousStatusRef.current = status;
            }
        });
        return () => unsub();
    }, [challengeId, user, saveHistory]);

    // Defensive: if match is active but questions are missing for this client,
    // try to re-fetch the challenge doc once to recover (handles transient sync issues).
    useEffect(() => {
        let cancelled = false;
        const tryRecover = async () => {
            if (!challengeId) return;
            if (matchState?.status !== 'active') return;
            const qs = matchState?.questions || [];
            if (qs.length > 0) return;

            try {
                const snap = await firestore().collection('challenges').doc(challengeId).get();
                if (!snap.exists) return;
                const data = snap.data();
                if (!cancelled && data?.questions && data.questions.length > 0) {
                    setMatchState(data);
                }
            } catch (e) {
                if (__DEV__) console.warn('Failed to recover challenge questions', e);
            }
        };

        tryRecover();

        return () => { cancelled = true; };
    }, [challengeId, matchState]);

    // If the challenge stores `questionIds` but we couldn't map them from local bank,
    // attempt to fetch the missing question objects from Firestore and attach them
    // to the local `matchState` so the UI can render immediately.
    useEffect(() => {
        let cancelled = false;
        const tryResolveQuestionIds = async () => {
            if (!matchState?.questionIds || (matchState?.questions && matchState.questions.length > 0)) return;
            const ids = matchState.questionIds || [];
            // Map using local bank first
            const mapped = ids.map(id => arenaQuestions.find(q => q.id === id)).filter(Boolean);
            if (mapped.length === ids.length) {
                setMatchState(prev => ({ ...(prev || {}), questions: mapped }));
                return;
            }

            // If we have provisional seeded questions (seeding mode), prefer using them
            // rather than fetching many arenaQuestion docs from Firestore which costs reads.
            if (provisionalQuestions && provisionalQuestions.length > 0) {
                setMatchState(prev => ({ ...(prev || {}), questions: provisionalQuestions }));
                return;
            }

            try {
                const docs = await Promise.all(ids.map(id => firestore().collection('arenaQuestions').doc(id).get()));
                const fetched = docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
                if (!cancelled && fetched.length > 0) {
                    // merge local mapped + fetched preserving original order
                    const byId = {};
                    [...mapped, ...fetched].forEach(q => { byId[q.id] = q; });
                    const final = ids.map(id => byId[id]).filter(Boolean);
                    setMatchState(prev => ({ ...(prev || {}), questions: final }));
                }
            } catch (e) {
                if (__DEV__) console.warn('Failed to fetch arenaQuestions by id', e);
            }
        };

        tryResolveQuestionIds();
        return () => { cancelled = true; };
    }, [matchState?.questionIds, arenaQuestions]);

    // Debug: log the question ids used by this client so you can confirm both
    // devices seeded the same set. Visible only in dev.
    useEffect(() => {
        if (!__DEV__) return;
        if (!questions) return;
        try {
            console.log('Challenge questions (ids):', questions.map(q => q.id));
        } catch (e) { }
    }, [questions]);

    useEffect(() => {
        const opponentId = matchState?.challengerId === user?.uid
            ? matchState?.opponentId
            : matchState?.challengerId;

        if (!opponentId || matchCompleted) return;

        // Use periodic `get()` checks instead of `onSnapshot` to avoid high-frequency reads
        let cancelled = false;
        const checkOpponent = async () => {
            try {
                const doc = await firestore().collection('users').doc(opponentId).get();
                if (cancelled || unavailableHandledRef.current || !matchState || matchState?.status !== 'active') return;
                if (!doc.exists) return;

                const data = doc.data() || {};
                const lastActiveMillis = data.lastActive?.toMillis?.() || 0;
                const offlineFor = lastActiveMillis ? Date.now() - lastActiveMillis : 0;

                if (data.isOnline === false && offlineFor >= OPPONENT_OFFLINE_MS) {
                    unavailableHandledRef.current = true;
                    firestoreService.completeChallengeForUnavailableOpponent(challengeId, user?.uid).catch(() => {
                        unavailableHandledRef.current = false;
                    });
                }
            } catch (e) {
                if (__DEV__) console.warn('Opponent presence check failed', e);
            }
        };

        // Initial check, then every 15s (less frequent than snapshot updates)
        checkOpponent();
        const interval = setInterval(checkOpponent, 15000);

        return () => { cancelled = true; clearInterval(interval); };
    }, [challengeId, matchCompleted, matchState, user?.uid]);

    useEffect(() => {
        if (matchCompleted) {
            timeoutHandledRef.current = false;
        }
    }, [matchCompleted]);

    // 3-Minute Timer (Synchronized with match start)
    useEffect(() => {
        if (!matchState || matchCompleted) return;
        if (matchState?.status !== 'active') return;

        // Use startTimeMs (number) first, then try startTime (Firestore Timestamp)
        const startTimeMs = matchState?.startTimeMs
            || matchState?.startTime?.toMillis?.()
            || 0;

        if (!startTimeMs) return;

        // Set initial time immediately
        const matchEndTime = startTimeMs + MATCH_DURATION_MS;
        const nowInit = Date.now() + (serverTimeOffset || 0);
        const initialRemaining = Math.max(0, Math.floor((matchEndTime - nowInit) / 1000));
        setTimeLeft(initialRemaining);

        const timer = setInterval(() => {
            const now = Date.now() + (serverTimeOffset || 0);
            const remaining = Math.max(0, Math.floor((matchEndTime - now) / 1000));

            setTimeLeft(remaining);

            if (!isFinished && remaining <= 0) {
                clearInterval(timer);
                handleTimeUp();
            }

            if (remaining <= 0 && !timeoutHandledRef.current) {
                timeoutHandledRef.current = true;
                // force: true — the timer already uses server-adjusted time,
                // so we know for certain the match has expired.
                firestoreService.finalizeMatchTimeout(challengeId, { force: true });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isFinished, matchCompleted, matchState?.status, matchState?.startTimeMs, matchState?.startTime, handleTimeUp, challengeId]);

    // If the timer reaches 0 and the match hasn't settled, trigger finalization.
    // No extra Firestore reads — settleMatchTransaction handles everything atomically.
    useEffect(() => {
        if (!matchState || matchCompleted) return;
        if (matchState?.status !== 'active') return;
        if (timeLeft > 0) return;
        setForceExpired(true);
    }, [timeLeft, matchState, matchCompleted]);

    // Safety net: if finished but match not yet resolved after 5s, attempt settlement.
    // Does NOT use force:true — that is reserved for when the 180s timer runs out.
    // Without force, finalizeMatchTimeout only settles if time has elapsed,
    // so this is safe to call mid-match without prematurely ending the opponent's quiz.
    useEffect(() => {
        if (!isFinished || matchCompleted || !challengeId) return;

        const timeout = setTimeout(() => {
            firestoreService.finalizeMatchTimeout(challengeId).catch(() => { });
        }, 5000);

        return () => clearTimeout(timeout);
    }, [isFinished, matchCompleted, challengeId]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswer = useCallback((selectedIndex) => {
        // If challenge hasn't been marked active yet (opponent didn't accept),
        // the challenger starting the quiz should activate it so timers run.
        if (matchState?.status !== 'active') {
            firestoreService.startChallengeIfPending(challengeId).catch(() => { });
        }

        const responseTime = Date.now() - questionStartTime;
        const isCorrect = selectedIndex === question.correctIndex;

        const answer = {
            questionId: question.id,
            selectedIndex,
            isCorrect,
            responseTime,
        };

        const newAnswers = [...answers, answer];
        answersRef.current = newAnswers;  // keep ref in sync
        setAnswers(newAnswers);
        // persist for review
        saveAnswersToCache(newAnswers).catch(() => {});

        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
            setQuestionStartTime(Date.now());
        } else {
            submitAllAnswers(newAnswers);
        }
    }, [currentQ, question, questionStartTime, answers, submitAllAnswers]);

    const correctCount = (answers || []).filter(a => a.isCorrect).length;
    const totalTime = (answers || []).reduce((s, a) => s + a.responseTime, 0);

    // Guard against timer firing after quiz already navigated away
    // Show spinner only if the matchState hasn't arrived yet. If matchState
    // exists but questions are empty, render a waiting placeholder so the
    // opponent info is visible instead of a blank loader.
    if (!isFinished && !matchState && (!provisionalQuestions || provisionalQuestions.length === 0)) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primaryGold} />
                <Text style={{ marginTop: 20, color: COLORS.lightBrown }}>Loading Challenge...</Text>
            </View>
        );
    }

    // Review Modal (uses local `questions` and `answers` only — no Firebase reads)
    const renderAnswerCard = ({ item, index }) => {
        const q = item;
        const userAnswer = (answers || []).find(a => a.questionId === q.id) || answers?.[index] || null;
        const selectedIndex = userAnswer?.selectedIndex;
        const selectedText = (typeof selectedIndex === 'number') ? q.options[selectedIndex] : 'No answer';
        const correctText = q.options[q.correctIndex];

        const renderSplit = (text) => {
            const parts = String(text || '').split(/\s*[-\/]\s*/);
            const english = parts[0]?.trim() || text;
            const roman = parts[1]?.trim() || null;
            return (
                <View>
                    <Text style={styles.reviewOptionEnglish}>{english}</Text>
                    {roman && <Text style={styles.reviewOptionRoman}>{roman}</Text>}
                </View>
            );
        };

        return (
            <View style={styles.reviewCard}>
                <Text style={styles.reviewQTitle}>Question {index + 1}</Text>
                <Text style={styles.reviewQuestion}>{q.question}</Text>

                <View style={{ marginTop: SPACING.sm }}>
                    <Text style={styles.reviewLabel}>Correct Answer</Text>
                    <View style={[styles.reviewAnswerRow, styles.correctBg]}>
                        {renderSplit(correctText)}
                    </View>
                </View>
            </View>
        );
    };

    const closeReview = () => setShowReview(false);

    // Show modal even if matchState empty; uses local questions + answers
    const ReviewModal = (
        <Modal visible={showReview} animationType="slide" onRequestClose={closeReview}>
            <View style={[styles.container, { paddingTop: SPACING.xl }]}> 
                <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.md }}>
                    <Text style={styles.resultTitle}>Review Answers</Text>
                    <Text style={styles.resultText}>Review your answers for this challenge.</Text>
                </View>

                <FlatList
                    data={questions}
                    keyExtractor={(i, idx) => i.id || String(idx)}
                    renderItem={renderAnswerCard}
                    contentContainerStyle={{ padding: SPACING.xl }}
                    ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
                />

                <View style={{ padding: SPACING.xl }}>
                    <TouchableOpacity style={styles.backButton} onPress={closeReview}>
                        <Text style={styles.backButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    if (!question && !isFinished) {
        // No question data yet but we have matchState — show waiting UI with opponent
        const opponentId = matchState?.challengerId === user?.uid
            ? matchState?.opponentId : matchState?.challengerId;
        const opponentName = users?.find(u => u.id === opponentId)?.name || 'Opponent';

        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primaryGold} />
                <Text style={{ marginTop: 16, color: COLORS.lightBrown, fontSize: FONT_SIZES.md }}>Waiting for questions...</Text>
                <Text style={{ marginTop: 6, color: COLORS.darkBrown }}>{opponentName}</Text>
            </View>
        );
    }

    if (matchState?.status === 'expired') {
        return (
            <View style={styles.container}>
                <View style={styles.resultContainer}>
                    <Icon name="clock-remove-outline" size={56} color={COLORS.primaryGold} />
                    <Text style={styles.resultTitle}>Challenge expired</Text>
                    <Text style={styles.resultText}>This challenge was not accepted in time.</Text>
                    <TouchableOpacity
                        style={[styles.backButton, styles.backButtonCompleted]}
                        onPress={() => navigation.goBack()}>
                        <Text style={[styles.backButtonText, { color: COLORS.cardBackground || '#FFF' }]}>Back to Challenge</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (matchState?.status === 'timeout_win') {
        // Opponent did not finish in time — show win-by-timeout
        const iWon = matchState?.winnerId === user?.uid;
        const opponentId = matchState?.challengerId === user?.uid
            ? matchState?.opponentId : matchState?.challengerId;
        const opponentName = users?.find(u => u.id === opponentId)?.name || 'Opponent';

        return (
            <View style={styles.container}>
                <View style={styles.resultContainer}>
                    <Icon name="clock-remove-outline" size={56} color={COLORS.primaryGold} />
                    <Text style={styles.resultTitle}>Opponent did not finish the quiz</Text>
                    <Text style={styles.resultText}>You win by default.</Text>
                    <Text style={styles.resultScore}>{(answers || []).filter(a => a.isCorrect).length} / {questions.length}</Text>
                    <TouchableOpacity
                        style={[styles.backButton, styles.backButtonCompleted]}
                        onPress={() => navigation.goBack()}>
                        <Text style={[styles.backButtonText, { color: COLORS.cardBackground || '#FFF' }]}>Back to Challenge</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }


    if (isFinished) {
        const iWon = matchState?.winnerId === user?.uid;
        const isTie = matchState?.status === 'completed' && matchState?.winnerId === 'tie';
        const isLose = matchCompleted && !iWon && !isTie;

        const iconName = matchCompleted
            ? (iWon || isTie ? 'crown' : 'close')
            : 'clock-outline';
        const iconColor = matchCompleted
            ? (iWon || isTie ? COLORS.primaryGold : COLORS.error || '#D94A4A')
            : COLORS.primaryGold;

        // Get opponent name
        const opponentId = matchState?.challengerId === user?.uid
            ? matchState?.opponentId : matchState?.challengerId;
        const myName = users?.find(u => u.id === user?.uid)?.name || 'Me';
        const opponentName = users?.find(u => u.id === opponentId)?.name || 'Opponent';

        const completionReason = matchState?.completionReason;
        const isDefaultWin = completionReason === 'opponent_unavailable';

        return (
            <View style={styles.container}>
                {/* ── Islamic Background Elements ── */}
                <View style={styles.bgDecorations} pointerEvents="none">
                    <Icon name="mosque" size={240} color={COLORS.primaryGold} style={styles.bgMosque} />
                    <Icon name="star-four-points-outline" size={40} color={COLORS.primaryGold} style={styles.bgStar1} />
                    <Icon name="star-four-points-outline" size={30} color={COLORS.primaryGold} style={styles.bgStar2} />
                </View>

                <View style={styles.resultContainerWrapper}>
                    {/* ── Result Card ── */}
                    <View style={styles.resultCard}>
                        {/* ── Icon Area ── */}
                        <View style={styles.iconContainer}>
                            <Icon name={iconName} size={40} color={iconColor} />
                        </View>

                        {/* ── Result Message ── */}
                        <Text style={styles.resultTitle}>
                            {!matchCompleted
                                ? 'Waiting for Opponent...'
                                : (isDefaultWin
                                    ? 'Opponent unavailable'
                                    : (isTie ? 'MashaAllah! It\'s a Tie! 🤝' : (iWon ? 'MashaAllah! You won 🎉' : 'SubhanAllah — You lost')))}
                        </Text>

                        {matchCompleted && isDefaultWin && (
                            <Text style={styles.resultText}>
                                The other player went offline for too long. You win by default.
                            </Text>
                        )}
                        {matchCompleted && isLose && (
                            <Text style={styles.resultText}>
                                SubhanAllah, you lost. Keep trying — may Allah provide you the right ilm.
                            </Text>
                        )}
                        {matchCompleted && iWon && !isDefaultWin && (
                            <Text style={styles.resultText}>
                                MashaAllah! You won — may Allah bless you with more knowledge.
                            </Text>
                        )}

                        {/* ── Arabic Dua ── */}
                        {matchCompleted && (
                            <View style={styles.duaContainer}>
                                <View style={styles.goldSeparator} />
                                <Text style={styles.arabicDuaText}>
                                    {iWon || isTie ? 'رَبِّ زِدْنِي عِلْمًا' : 'اللَّهُمَّ زِدْنِي عِلْمًا'}
                                </Text>
                                <Text style={styles.arabicTranslationText}>
                                    {iWon || isTie ? '"My Lord, increase me in knowledge."' : '"O Allah, increase me in knowledge."'}
                                </Text>
                                <View style={styles.goldSeparator} />
                            </View>
                        )}

                        {/* ── Score Display ── */}
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreLabel}>Score</Text>
                            <Text style={styles.resultScore}>
                                {correctCount} / {questions.length}
                            </Text>
                            <Text style={styles.scoreLabel}>Time taken</Text>
                            <Text style={styles.resultTime}>
                                {(totalTime / 1000).toFixed(1)} seconds
                            </Text>
                        </View>

                        {/* Waiting countdown */}
                        {!matchCompleted && (
                            <>
                                <Text style={styles.waitingTimer}>
                                    ⏱️ Remaining: {formatTime(timeLeft)}
                                </Text>
                                <Text style={styles.waitingText}>
                                    Waiting for {opponentName} to finish.
                                </Text>
                            </>
                        )}
                    </View>

                    {/* ── Action Buttons ── */}
                    <View style={styles.actionButtonsContainer}>
                        {matchCompleted && (
                            <>
                                {/* Hidden off-screen share card — captured by view-shot */}
                                <ViewShot
                                    ref={shareRef}
                                    options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1080 }}
                                    style={styles.offscreen}>
                                    <ResultShareCard
                                        userName={myName}
                                        opponentName={opponentName}
                                        score={correctCount}
                                        total={questions.length}
                                        isWin={iWon}
                                        timeSeconds={(totalTime / 1000).toFixed(1)}
                                    />
                                </ViewShot>

                                <TouchableOpacity
                                    style={[styles.backButton, styles.shareButtonCard]}
                                    onPress={() => captureAndShare({
                                        opponentName,
                                        isWin: iWon,
                                        score: correctCount,
                                        total: questions.length,
                                        timeSeconds: (totalTime / 1000).toFixed(1),
                                    })}
                                    disabled={sharing}>
                                    {sharing
                                        ? <ActivityIndicator size="small" color="#FFF" />
                                        : <>
                                            <Icon name="share-variant" size={18} color="#FFF" />
                                            <Text style={[styles.backButtonText, { color: '#FFF', marginLeft: 8 }]}>Share Result</Text>
                                        </>
                                    }
                                </TouchableOpacity>

                                <View style={styles.actionButtonsContainer}>
                                    <TouchableOpacity
                                        style={styles.secondaryButtonCard}
                                        onPress={async () => {
                                            // load cached answers first (if any) then open review
                                            try {
                                                const cached = await loadAnswersFromCache();
                                                if (cached && Array.isArray(cached)) {
                                                    // prefer cached saved answers for the review view
                                                    setAnswers(cached);
                                                }
                                            } catch (e) {
                                                if (__DEV__) console.warn('failed to load cached answers', e);
                                            }
                                            setShowReview(true);
                                        }}>
                                        <Text style={styles.secondaryButtonTextCard}>Review Answers</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.backButton, styles.backButtonCompletedCard]}
                                        onPress={() => navigation.goBack()}>
                                        <Text style={[styles.backButtonText, { color: COLORS.darkBrown }]}>Back to Challenge</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {!matchCompleted && (
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}>
                                <Text style={styles.backButtonText}>Back to Challenge</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                        {ReviewModal}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Progress */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="close" size={22} color={COLORS.darkBrown} />
                </TouchableOpacity>
                <View style={styles.timerChip}>
                    <Icon name="clock-outline" size={16} color={timeLeft <= 30 ? (COLORS.error || '#D94A4A') : COLORS.darkBrown} />
                    <Text style={[styles.timerText, timeLeft <= 30 && { color: COLORS.error || '#D94A4A' }]}>
                        {formatTime(timeLeft)}
                    </Text>
                </View>
                <Text style={styles.progressText}>
                    {currentQ + 1} / {questions.length}
                </Text>
            </View>

            <View style={styles.progressBarContainer}>
                <View
                    style={[
                        styles.progressBar,
                        { width: `${((currentQ + 1) / (questions.length || 1)) * 100}%` },
                    ]}
                />
            </View>

            {/* Question */}
            <ScrollView style={styles.questionContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={{ marginBottom: SPACING.md, flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <TouchableOpacity onPress={() => setLanguageMode('english')} style={[styles.langToggle, languageMode === 'english' && styles.langToggleActive]}>
                        <Text style={[styles.langToggleText, languageMode === 'english' && styles.langToggleTextActive]}>English</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setLanguageMode('roman')} style={[styles.langToggle, languageMode === 'roman' && styles.langToggleActive]}>
                        <Text style={[styles.langToggleText, languageMode === 'roman' && styles.langToggleTextActive]}>E-Urdu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setLanguageMode('both')} style={[styles.langToggle, languageMode === 'both' && styles.langToggleActive]}>
                        <Text style={[styles.langToggleText, languageMode === 'both' && styles.langToggleTextActive]}>Both</Text>
                    </TouchableOpacity>
                </View>

                {languageMode !== 'roman' && (
                    <Text style={styles.questionText}>{question.question}</Text>
                )}
                {languageMode !== 'english' && question.questionRoman && (
                    <Text style={styles.questionRomanText}>{question.questionRoman}</Text>
                )}
                
                <ScrollView style={{ maxHeight: languageMode === 'both' ? Math.min(420, Dimensions.get('window').height * 0.5) : undefined, width: '100%' }} contentContainerStyle={{ paddingBottom: SPACING.md }}>
                    <View style={styles.optionsContainer}>
                    {question.options.map((option, index) => {
                        const parts = String(option || '').split(/\s*[-\/]\s*/);
                        const english = parts[0]?.trim() || option;
                        const roman = parts[1]?.trim() || null;

                        // Fallback rules:
                        // - `english` mode: always show English
                        // - `roman` mode: show Roman if available, otherwise fall back to English
                        // - `both` mode: show both if Roman available, otherwise show English only
                        const showEnglish = (languageMode === 'english') || (languageMode === 'both') || (languageMode === 'roman' && !roman);
                        const showRoman = ((languageMode === 'roman' || languageMode === 'both') && !!roman);

                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.option}
                                onPress={() => handleAnswer(index)}
                                activeOpacity={0.7}>
                                <View style={styles.optionNumber}>
                                    <Text style={styles.optionNumberText}>
                                        {String.fromCharCode(65 + index)}
                                    </Text>
                                </View>
                                <View style={styles.optionContainer}>
                                    {showEnglish && <Text style={styles.optionEnglish}>{english}</Text>}
                                    {showRoman && <Text style={styles.optionRoman}>{roman}</Text>}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    </View>
                </ScrollView>
            </ScrollView>
            {ReviewModal}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    // Off-screen but still renders — DO NOT use opacity:0, ViewShot can't capture invisible views
    offscreen: {
        position: 'absolute',
        top: -9999,
        left: -9999,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xxl + 16,
        paddingBottom: SPACING.md,
    },
    timerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.pill,
        gap: 4,
        ...SHADOWS.elevated,
    },
    timerText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    },
    progressText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    },
    progressBarContainer: {
        height: 3,
        backgroundColor: COLORS.beigeDark,
        marginHorizontal: SPACING.xl,
        borderRadius: 2,
        marginBottom: SPACING.xxl,
    },
    progressBar: {
        height: '100%',
        backgroundColor: COLORS.primaryGold,
        borderRadius: 2,
    },
    questionContainer: {
        flex: 1,
        padding: SPACING.xl,
    },
    questionText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
        lineHeight: 28,
        marginBottom: SPACING.xs,
    },
    questionRomanText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.xl,
        color: COLORS.lanternPurpleSoft,
        lineHeight: 26,
        marginBottom: SPACING.xxl,
        fontStyle: 'italic',
    },
    optionsContainer: {
        gap: SPACING.md,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        gap: SPACING.md,
        ...SHADOWS.card,
    },
    optionNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryGold + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionNumberText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.primaryGold,
    },
    optionText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
        flex: 1,
    },

    optionContainer: {
        flex: 1,
    },
    optionEnglish: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
        fontWeight: '500',
    },
    optionRoman: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: '#3A1C5E',
        marginTop: 4,
        fontStyle: 'italic',
    },

    langToggle: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.primaryGold,
        marginLeft: 8,
        backgroundColor: 'transparent',
    },
    langToggleActive: {
        backgroundColor: COLORS.primaryGold,
        borderColor: COLORS.primaryGold,
    },
    langToggleText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.primaryGold,
        textAlign: 'center',
    },
    langToggleTextActive: {
        color: '#FFF',
    },

    /* Review styles */
    reviewCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.card,
    },
    reviewQTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginBottom: SPACING.xs,
    },
    reviewQuestion: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        marginBottom: SPACING.sm,
    },
    reviewLabel: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        color: COLORS.lightBrown,
        marginBottom: SPACING.xs,
    },
    reviewAnswerRow: {
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    correctBg: {
        backgroundColor: COLORS.success ? (COLORS.success + '10') : '#E6F7EA',
    },
    wrongBg: {
        backgroundColor: COLORS.error ? (COLORS.error + '10') : '#FDECEA',
    },
    reviewOptionEnglish: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    },
    reviewOptionRoman: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: '#3A1C5E',
        marginTop: 4,
        fontStyle: 'italic',
    },
    resultContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xxl,
    },
    resultTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
        marginTop: SPACING.xl,
        marginBottom: SPACING.md,
        textAlign: 'center',
        paddingHorizontal: SPACING.md,
    },
    resultScore: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.display,
        color: COLORS.primaryGold,
        marginBottom: SPACING.sm,
    },
    resultText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        textAlign: 'center',
        marginBottom: SPACING.xxxl,
        marginTop: SPACING.md,
    },
    resultTime: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        marginBottom: SPACING.xxl,
    },
    waitingTimer: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.primaryGold,
        marginBottom: SPACING.md,
    },
    waitingText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        fontStyle: 'italic',
        marginBottom: SPACING.xxl,
        textAlign: 'center',
    },
    shareButton: {
        backgroundColor: '#25D366',
        borderColor: '#25D366',
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    backButton: {
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.primaryGold,
        width: '100%',
        alignItems: 'center',
    },
    backButtonCompleted: {
        backgroundColor: COLORS.primaryGold,
    },
    backButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.primaryGold,
        letterSpacing: 1,
    },

    // NEW CLASSES FOR RESULT CARD
    bgDecorations: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.05,
    },
    bgMosque: {
        position: 'absolute',
        bottom: -40,
        right: -60,
    },
    bgStar1: {
        position: 'absolute',
        top: 80,
        left: 20,
    },
    bgStar2: {
        position: 'absolute',
        top: 140,
        right: 40,
    },
    resultContainerWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start', // pin from top so internal height changes don't push card off-screen
        padding: SPACING.xl,
        paddingTop: SPACING.xxl * 2,
        paddingBottom: SPACING.xxxl, // keep some bottom breathing room
    },
    resultCard: {
        backgroundColor: COLORS.cream,
        width: '94%',
        borderRadius: 16,
        padding: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primaryGold + '40',
        ...SHADOWS.elevated,
        marginBottom: SPACING.lg,
    },

    resultCardWin: {
        backgroundColor: '#E8F6EA', // pastel green
        borderColor: '#C8E6C9',
    },
    resultCardLose: {
        backgroundColor: '#FDECEF', // pastel pink
        borderColor: '#F8C8D0',
    },
    resultCardWaiting: {
        backgroundColor: '#FFF8E1', // pastel yellow
        borderColor: '#FFECB3',
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -SPACING.xxl - 8, // further reduce overlap
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.creamBorder,
        ...SHADOWS.card,
    },
    duaContainer: {
        width: '100%',
        alignItems: 'center',
        marginVertical: SPACING.sm,
    },
    goldSeparator: {
        height: 1,
        width: '60%',
        backgroundColor: COLORS.primaryGold + '40',
        marginVertical: SPACING.sm,
    },
    arabicDuaText: {
        fontSize: FONT_SIZES.xxl,
        color: COLORS.primaryGold,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: SPACING.xs,
        lineHeight: 32,
    },
    arabicTranslationText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    scoreContainer: {
        alignItems: 'center',
        marginTop: SPACING.sm,
        backgroundColor: COLORS.backgroundAlt,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        width: '100%',
    },
    scoreLabel: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    actionButtonsContainer: {
        width: '100%',
        gap: SPACING.md,
        marginBottom: SPACING.xxl * 2, // smaller, consistent spacing above nav
    },
    shareButtonCard: {
        backgroundColor: COLORS.success || '#25D366', // whatsapp green
        borderColor: COLORS.success || '#25D366',
        flexDirection: 'row',
        justifyContent: 'center',
        ...SHADOWS.card,
    },
    backButtonCompletedCard: {
        backgroundColor: COLORS.primaryGold,
        borderColor: COLORS.primaryGold,
        ...SHADOWS.card,
    },
    secondaryButtonCard: {
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    secondaryButtonTextCard: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
    },
});
