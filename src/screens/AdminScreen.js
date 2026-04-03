/**
 * AdminScreen — Full admin analytics: quiz overview, response table, end quiz, quiz creation.
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker from 'react-native-date-picker';
import ViewShot from 'react-native-view-shot';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useUsersContext } from '../context/UsersContext';
import { LeaderboardShareCard } from '../components/LeaderboardShareCard';
import { useLeaderboardShare } from '../hooks/useLeaderboardShare';
import { firestoreService } from '../services/firebaseService';

const POINTS_MAP = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4 };
const DEFAULT_POINTS = 1; // participation

export default function AdminScreen() {
    const { userRole, serverTimeOffset } = useAuth();
    const { shareRef, sharing: sharingImage, captureAndShare } = useLeaderboardShare();

    // Quiz data
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [responses, setResponses] = useState([]);
    const { users: overallUsers } = useUsersContext();
    const [quizLoading, setQuizLoading] = useState(true);
    const [endingQuiz, setEndingQuiz] = useState(false);

    // Section toggle
    const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'responses' | 'create' | 'marathon'

    // Create Quiz form state
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '', '', '']);
    const [newCorrectIndex, setNewCorrectIndex] = useState(0);
    const [unlockTime, setUnlockTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 86400000));
    const [openUnlockPicker, setOpenUnlockPicker] = useState(false);
    const [openEndPicker, setOpenEndPicker] = useState(false);
    const [creating, setCreating] = useState(false);
    const [cleaningStorage, setCleaningStorage] = useState(false);
    const [dailyLeaderboardApproved, setDailyLeaderboardApproved] = useState(false);
    const [togglingLeaderboard, setTogglingLeaderboard] = useState(false);

    // Marathon Admin State
    const [marathonDayNumber, setMarathonDayNumber] = useState('');
    const [marathonQuestion, setMarathonQuestion] = useState('');
    const [marathonOptions, setMarathonOptions] = useState(['', '', '', '']);
    const [marathonCorrectIndex, setMarathonCorrectIndex] = useState(0);
    const [marathonUnlockTime, setMarathonUnlockTime] = useState(new Date());
    const [openMarathonUnlockPicker, setOpenMarathonUnlockPicker] = useState(false);
    const [marathonCreating, setMarathonCreating] = useState(false);
    const [approvingCerts, setApprovingCerts] = useState(false);

    // Arena Admin State
    const [arenaJson, setArenaJson] = useState('');
    const [uploadingArena, setUploadingArena] = useState(false);

    // Test Mode State
    const [isTestMode, setIsTestMode] = useState(false);

    // Real-time listener for active quiz
    useEffect(() => {
        if (userRole !== 'admin') return;

        const unsubQuiz = firestore()
            .collection('quizzes')
            .orderBy('unlockTime', 'desc')
            .limit(10)
            .onSnapshot(async snap => {
                if (!snap) return;
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                const active = all.find(q => q.status !== 'ended') || all[0] || null;
                setActiveQuiz(active);
                setQuizLoading(false);

                if (!active) return;

                // Real-time listener for responses (single-field query = no index needed)
                const unsubResp = firestore()
                    .collection('quizResponses')
                    .where('quizId', '==', active.id)
                    .onSnapshot(async respSnap => {
                        if (!respSnap) return;
                        // Sort by submittedAt in JS to avoid composite index requirement
                        const docs = respSnap.docs
                            .map(d => ({ id: d.id, ...d.data() }))
                            .sort((a, b) => {
                                const tA = a.submittedAt?.toMillis?.() ?? 0;
                                const tB = b.submittedAt?.toMillis?.() ?? 0;
                                return tA - tB;
                            });

                        setResponses(docs);
                    });

                return () => unsubResp();
            });

        return () => unsubQuiz();
    }, [userRole]);

    // Real-time listener for leaderboard approval status
    useEffect(() => {
        if (userRole !== 'admin') return;

        const unsubMeta = firestore()
            .collection('meta')
            .doc('dailyLeaderboard')
            .onSnapshot(doc => {
                if (doc && doc.exists) {
                    setDailyLeaderboardApproved(doc.data()?.approved || false);
                } else {
                    setDailyLeaderboardApproved(false);
                }
            });

        return () => unsubMeta();
    }, [userRole]);

    // Compute stats
    const totalParticipants = responses.length;
    const totalCorrect = responses.filter(r => r.isCorrect).length;
    const totalIncorrect = responses.filter(r => !r.isCorrect).length;
    const firstResponder = responses.length > 0 ? responses[0] : null;
    const lastResponder = responses.length > 0 ? responses[responses.length - 1] : null;

    const getUserName = (uid) => overallUsers.find(u => u.id === uid)?.name || uid;
    const formatTime = (ts) => {
        if (!ts) return '--';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getServerTimePreview = (localDate) => {
        const trueTime = new Date(localDate.getTime() + (serverTimeOffset || 0));
        return trueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleCleanupStorage = async () => {
        Alert.alert(
            'Clean Firebase Storage',
            'This will remove stored duas data and settle expired or inactive Arena records.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clean',
                    style: 'destructive',
                    onPress: async () => {
                        setCleaningStorage(true);
                        try {
                            const [deletedDuas, cleanupResult] = await Promise.all([
                                firestoreService.cleanupDuaCollection(),
                                firestoreService.runStorageCleanup(),
                            ]);
                            Alert.alert(
                                'Cleanup complete',
                                `Deleted ${deletedDuas} dua documents. Expired ${cleanupResult.expiredChallenges} challenges and settled ${cleanupResult.settledMatches} matches.`,
                            );
                        } catch (e) {
                            Alert.alert('Error', 'Failed to clean Firebase storage: ' + e.message);
                        } finally {
                            setCleaningStorage(false);
                        }
                    },
                },
            ],
        );
    };

    const handleEndQuiz = async () => {
        if (!activeQuiz) return;
        Alert.alert(
            'End Quiz',
            'This will assign points to correct respondents and mark the quiz as ended.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Quiz',
                    style: 'destructive',
                    onPress: async () => {
                        setEndingQuiz(true);
                        try {
                            const allSnap = await firestore()
                                .collection('quizResponses')
                                .where('quizId', '==', activeQuiz.id)
                                .get();

                            const allDocs = allSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
                            const correctDocs = allDocs
                                .filter(d => d.data.isCorrect === true)
                                .sort((a, b) => {
                                    const tA = a.data.submittedAt?.toMillis?.() ?? 0;
                                    const tB = b.data.submittedAt?.toMillis?.() ?? b.data.submittedAt ?? 0;
                                    return tA - tB;
                                });

                            const correctUserIds = new Set(correctDocs.map(d => d.data.userId));
                            const batch = firestore().batch();

                            correctDocs.forEach((docObj, idx) => {
                                const rank = idx + 1;
                                const pts = POINTS_MAP[rank] ?? DEFAULT_POINTS;
                                const userRef = firestore().collection('users').doc(docObj.data.userId);
                                batch.update(userRef, {
                                    totalOverallPoints: firestore.FieldValue.increment(pts),
                                });
                                batch.update(docObj.ref, { rank, awardedPoints: pts });
                            });

                            allDocs.forEach(docObj => {
                                if (!correctUserIds.has(docObj.data.userId)) {
                                    const userRef = firestore().collection('users').doc(docObj.data.userId);
                                    batch.update(userRef, {
                                        totalOverallPoints: firestore.FieldValue.increment(DEFAULT_POINTS),
                                    });
                                    batch.update(docObj.ref, { rank: null, awardedPoints: DEFAULT_POINTS });
                                }
                            });

                            const quizRef = firestore().collection('quizzes').doc(activeQuiz.id);
                            batch.update(quizRef, {
                                status: 'ended',
                                resultsRevealed: true,
                                endTime: firestore.FieldValue.serverTimestamp(),
                            });

                            await batch.commit();
                            Alert.alert('Success', 'Quiz ended and points distributed!');
                        } catch (e) {
                            if (__DEV__) console.error('End quiz error:', e);
                            Alert.alert('Error', 'Failed to end quiz: ' + e.message);
                        } finally {
                            setEndingQuiz(false);
                        }
                    },
                },
            ],
        );
    };

    const handleDeleteQuiz = async (quizId) => {
        Alert.alert(
            'Delete Quiz',
            'Are you sure? This will delete the quiz and ALL its responses. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const batch = firestore().batch();

                            // Delete responses
                            const resps = await firestore().collection('quizResponses').where('quizId', '==', quizId).get();
                            resps.forEach(d => batch.delete(d.ref));

                            // Delete quiz
                            batch.delete(firestore().collection('quizzes').doc(quizId));

                            await batch.commit();
                            Alert.alert('Deleted', 'Quiz and responses removed.');
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete quiz: ' + e.message);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteMarathonQuiz = async (quizId) => {
        Alert.alert(
            'Delete Marathon Question',
            'Are you sure? This will delete this specific question and its responses.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const batch = firestore().batch();
                            const resps = await firestore().collection('marathonResponses').where('marathonQuizId', '==', quizId).get();
                            resps.forEach(d => batch.delete(d.ref));
                            batch.delete(firestore().collection('marathonQuizzes').doc(quizId));
                            await batch.commit();
                            Alert.alert('Deleted', 'Marathon question removed.');
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete: ' + e.message);
                        }
                    }
                }
            ]
        );
    };

    // Build leaderboard data for share card from responses
    const getShareCardData = () => {
        const correctResps = responses
            .filter(r => r.isCorrect)
            .sort((a, b) => {
                const tA = a.submittedAt?.toMillis?.() ?? a.submittedAt ?? 0;
                const tB = b.submittedAt?.toMillis?.() ?? b.submittedAt ?? 0;
                return tA - tB;
            });
        const enriched = correctResps.map(r => ({ name: getUserName(r.userId) }));
        return {
            topThree: enriched.slice(0, 3),
            remaining: enriched.slice(3),
        };
    };

    const shareData = getShareCardData();

    const handleCreateQuiz = async () => {
        if (!newQuestion.trim() || newOptions.some(o => !o.trim())) {
            Alert.alert('Missing Fields', 'Please fill in the question and all 4 options.');
            return;
        }
        setCreating(true);
        try {
            const collectionName = isTestMode ? 'testQuizzes' : 'quizzes';
            const snap = await firestore().collection(collectionName).orderBy('dayNumber', 'desc').limit(1).get();
            const lastDay = snap.empty ? 0 : (snap.docs[0].data().dayNumber || 0);

            await firestore().collection(collectionName).add({
                question: newQuestion.trim(),
                options: newOptions.map(o => o.trim()),
                correctIndex: newCorrectIndex,
                unlockTime: firestore.Timestamp.fromDate(unlockTime),
                endTime: firestore.Timestamp.fromDate(endTime),
                status: 'scheduled',
                createdAt: firestore.FieldValue.serverTimestamp(),
                dayNumber: lastDay + 1,
                isTest: isTestMode,
            });

            if (!isTestMode) {
                await firestoreService.sendDailyQuizNotification(unlockTime);
                Alert.alert('Success', 'Quiz created and notification scheduled!');
            } else {
                Alert.alert('Test Success', 'Test Quiz created in testQuizzes collection. No notifications sent.');
            }

            setNewQuestion('');
            setNewOptions(['', '', '', '']);
            setNewCorrectIndex(0);
        } catch (e) {
            if (__DEV__) console.error('Create quiz error:', e);
            Alert.alert('Error', 'Failed to create quiz.');
        } finally {
            setCreating(false);
        }
    };

    const handleToggleLeaderboard = async () => {
        setTogglingLeaderboard(true);
        try {
            await firestore()
                .collection('meta')
                .doc('dailyLeaderboard')
                .set({ approved: !dailyLeaderboardApproved }, { merge: true });
        } catch (e) {
            Alert.alert('Error', 'Could not toggle leaderboard visibility');
        } finally {
            setTogglingLeaderboard(false);
        }
    };

    const handleCreateMarathonQuestion = async () => {
        const dayNum = parseInt(marathonDayNumber, 10);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 30) {
            Alert.alert('Invalid Day', 'Please enter a valid day number (1-30).');
            return;
        }
        if (!marathonQuestion.trim() || marathonOptions.some(o => !o.trim())) {
            Alert.alert('Missing Fields', 'Please fill in the question and all 4 options.');
            return;
        }

        setMarathonCreating(true);
        try {
            const collectionName = isTestMode ? 'testMarathonQuizzes' : 'marathonQuizzes';
            await firestore().collection(collectionName).add({
                dayNumber: dayNum,
                question: marathonQuestion.trim(),
                options: marathonOptions.map(o => o.trim()),
                correctIndex: marathonCorrectIndex,
                unlockTime: firestore.Timestamp.fromDate(marathonUnlockTime),
                status: 'scheduled',
                createdAt: firestore.FieldValue.serverTimestamp(),
                isTest: isTestMode,
            });

            if (!isTestMode) {
                await firestoreService.sendMarathonUpdateNotification(marathonUnlockTime);
                Alert.alert('Success', `Monthly challenge question for Day ${dayNum} created and notification scheduled!`);
            } else {
                Alert.alert('Test Success', 'Test Monthly question created in testMarathonQuizzes. No notification sent.');
            }
            setMarathonQuestion('');
            setMarathonOptions(['', '', '', '']);
            setMarathonCorrectIndex(0);
        } catch (error) {
            if (__DEV__) console.error('Error creating monthly challenge question:', error);
            Alert.alert('Error', 'Failed to create monthly challenge question.');
        } finally {
            setMarathonCreating(false);
        }
    };

    const handleApproveCertificates = async () => {
        Alert.alert(
            'Approve Certificates',
            'This will compute the monthly challenge percentage for all participants. Anyone with 60% or more will be marked eligible for the certificate.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve', onPress: async () => {
                        setApprovingCerts(true);
                        try {
                            const [questionsSnap, responsesSnap] = await Promise.all([
                                firestore().collection('marathonQuizzes').get(),
                                firestore().collection('marathonResponses').get()
                            ]);

                            const totalQuestions = questionsSnap.size;
                            if (totalQuestions === 0) {
                                Alert.alert('Error', 'No monthly challenge questions found.');
                                setApprovingCerts(false);
                                return;
                            }

                            const userScores = {};
                            responsesSnap.docs.forEach(doc => {
                                const data = doc.data();
                                if (!userScores[data.userId]) userScores[data.userId] = 0;
                                if (data.isCorrect) userScores[data.userId] += 1;
                            });

                            const PASS_PERCENTAGE = 60;
                            const batch = firestore().batch();
                            let eligibleCount = 0;

                            for (const [userId, correctCount] of Object.entries(userScores)) {
                                const percentage = (correctCount / totalQuestions) * 100;
                                if (percentage >= PASS_PERCENTAGE) {
                                    const userRef = firestore().collection('users').doc(userId);
                                    batch.update(userRef, {
                                        marathonEligible: true,
                                        monthlyChallengeEligible: true,
                                    });
                                    eligibleCount++;
                                }
                            }

                            // Set global flag
                            const metaRef = firestore().collection('meta').doc('marathonSettings');
                            batch.set(metaRef, { approved: true }, { merge: true });

                            await batch.commit();
                            Alert.alert('Success', `${eligibleCount} users have been approved for certificates!`);
                        } catch (error) {
                            if (__DEV__) console.error('Error approving certificates:', error);
                            Alert.alert('Error', 'Failed to approve certificates.');
                        } finally {
                            setApprovingCerts(false);
                        }
                    }
                }
            ]
        );
    };

    const handleBulkUploadArena = async () => {
        if (!arenaJson.trim()) {
            Alert.alert('Empty', 'Please paste the JSON questions first.');
            return;
        }

        let questionsArray = [];
        try {
            questionsArray = JSON.parse(arenaJson);
            if (!Array.isArray(questionsArray)) throw new Error('Root must be an array');
        } catch (e) {
            Alert.alert('Invalid JSON', 'The pasted text is not a valid JSON array.');
            return;
        }

        // Basic validation
        const isValid = questionsArray.every(q =>
            q.question &&
            q.questionRoman &&
            Array.isArray(q.options) &&
            q.options.length >= 2 &&
            typeof q.correctIndex === 'number'
        );

        if (!isValid) {
            Alert.alert('Validation Error', 'Some questions are missing required fields (question, questionRoman, options, correctIndex).');
            return;
        }

        setUploadingArena(true);
        try {
            const batch = firestore().batch();
            questionsArray.forEach(q => {
                const docRef = firestore().collection('arenaQuestions').doc();
                batch.set(docRef, {
                    ...q,
                    createdAt: firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            Alert.alert('Success', `Successfully uploaded ${questionsArray.length} questions to Arena bank!`);
            setArenaJson('');
        } catch (e) {
            if (__DEV__) console.error('Arena bulk upload error:', e);
            Alert.alert('Error', 'Failed to upload questions: ' + e.message);
        } finally {
            setUploadingArena(false);
        }
    };

    const handleDeleteAllArenaQuestions = async () => {
        Alert.alert(
            'Delete All Questions',
            'Are you sure you want to permanently delete ALL questions from the Arena bank? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                        setUploadingArena(true);
                        try {
                            const snapshot = await firestore().collection('arenaQuestions').get();
                            const batch = firestore().batch();
                            snapshot.docs.forEach(doc => {
                                batch.delete(doc.ref);
                            });
                            await batch.commit();
                            Alert.alert('Success', 'Arena question bank has been cleared.');
                        } catch (e) {
                            Alert.alert('Error', 'Failed to clear bank: ' + e.message);
                        } finally {
                            setUploadingArena(false);
                        }
                    }
                }
            ]
        );
    };

    if (userRole !== 'admin') {
        return (
            <View style={styles.container}>
                <Text style={styles.noAccessText}>Access Denied</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Admin Panel</Text>

                {/* Active Quiz Pill */}
                {activeQuiz && (
                    <View style={styles.activeQuizBanner}>
                        <View style={styles.liveIndicator} />
                        <Text style={styles.activeQuizText} numberOfLines={2}>
                            {activeQuiz.status === 'ended' ? '✓ Ended: ' : '● Active: '}
                            {activeQuiz.question}
                        </Text>
                        <TouchableOpacity
                            onPress={() => handleDeleteQuiz(activeQuiz.id)}
                            style={styles.deletePillBtn}>
                            <Icon name="trash-can-outline" size={18} color={COLORS.error} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Section Tabs */}
                <View style={styles.sectionTabs}>
                    {[
                        { key: 'overview', label: 'Overview', icon: 'chart-bar' },
                        { key: 'responses', label: 'Responses', icon: 'table' },
                        { key: 'create', label: 'Create Quiz', icon: 'plus-circle' },
                        { key: 'marathon', label: 'Monthly', icon: 'flag-checkered' },
                        { key: 'arena', label: 'Arena Qs', icon: 'sword-cross' },
                        { key: 'duas', label: 'Cleanup', icon: 'broom' },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.sectionTab, activeSection === tab.key && styles.sectionTabActive]}
                            onPress={() => setActiveSection(tab.key)}>
                            <Icon
                                name={tab.icon}
                                size={14}
                                color={activeSection === tab.key ? COLORS.cardBackground : COLORS.lightBrown}
                            />
                            <Text
                                style={[
                                    styles.sectionTabText,
                                    activeSection === tab.key && styles.sectionTabTextActive,
                                ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {quizLoading ? (
                    <ActivityIndicator size="large" color={COLORS.primaryGold} style={{ marginTop: 40 }} />
                ) : (
                    <>
                        {/* ───────── OVERVIEW SECTION ───────── */}
                        {activeSection === 'overview' && (
                            <View>
                                {!activeQuiz ? (
                                    <Text style={styles.emptyText}>No active quiz found.</Text>
                                ) : (
                                    <>
                                        {/* Stat Cards */}
                                        <View style={styles.statsGrid}>
                                            <View style={[styles.statCard, { flex: 1 }]}>
                                                <Text style={styles.statNumber}>{totalParticipants}</Text>
                                                <Text style={styles.statLabel}>Participants</Text>
                                            </View>
                                            <View style={[styles.statCard, styles.statCardCorrect, { flex: 1 }]}>
                                                <Text style={[styles.statNumber, { color: COLORS.success }]}>{totalCorrect}</Text>
                                                <Text style={styles.statLabel}>Correct</Text>
                                            </View>
                                            <View style={[styles.statCard, styles.statCardWrong, { flex: 1 }]}>
                                                <Text style={[styles.statNumber, { color: COLORS.error }]}>{totalIncorrect}</Text>
                                                <Text style={styles.statLabel}>Incorrect</Text>
                                            </View>
                                        </View>

                                        {/* First & Last responder */}
                                        {firstResponder && (
                                            <View style={styles.responderCard}>
                                                <Icon name="flag-checkered" size={16} color={COLORS.primaryGold} />
                                                <View style={styles.responderInfo}>
                                                    <Text style={styles.responderLabel}>First Correct Answer</Text>
                                                    <Text style={styles.responderName}>{getUserName(firstResponder.userId)}</Text>
                                                    <Text style={styles.responderTime}>{formatTime(firstResponder.submittedAt)}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {lastResponder && lastResponder !== firstResponder && (
                                            <View style={styles.responderCard}>
                                                <Icon name="clock-end" size={16} color={COLORS.lightBrown} />
                                                <View style={styles.responderInfo}>
                                                    <Text style={styles.responderLabel}>Last Respondent</Text>
                                                    <Text style={styles.responderName}>{getUserName(lastResponder.userId)}</Text>
                                                    <Text style={styles.responderTime}>{formatTime(lastResponder.submittedAt)}</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* End Quiz Button */}
                                        {activeQuiz.status !== 'ended' && (
                                            <TouchableOpacity
                                                style={[styles.endQuizBtn, endingQuiz && styles.endQuizBtnDisabled]}
                                                onPress={handleEndQuiz}
                                                disabled={endingQuiz}>
                                                {endingQuiz ? (
                                                    <ActivityIndicator size="small" color="#FFF" />
                                                ) : (
                                                    <>
                                                        <Icon name="check-decagram" size={20} color="#FFF" />
                                                        <Text style={styles.endQuizBtnText}>End Quiz & Assign Points</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        )}

                                        {/* Share Results Button */}
                                        {activeQuiz.status === 'ended' && activeQuiz.resultsRevealed && shareData.topThree.length > 0 && (
                                            <>
                                                {/* Hidden off-screen leaderboard card */}
                                                <ViewShot
                                                    ref={shareRef}
                                                    options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 3000 }}
                                                    style={styles.offscreen}>
                                                    <LeaderboardShareCard
                                                        topThree={shareData.topThree}
                                                        remaining={shareData.remaining}
                                                        variant={'daily'}
                                                    />
                                                </ViewShot>

                                                <TouchableOpacity
                                                    style={[styles.endQuizBtn, { backgroundColor: '#25D366', marginTop: 12 }]}
                                                    onPress={captureAndShare}
                                                    disabled={sharingImage}>
                                                    {sharingImage
                                                        ? <ActivityIndicator size="small" color="#FFF" />
                                                        : <>
                                                            <Icon name="share-variant" size={20} color="#FFF" />
                                                            <Text style={styles.endQuizBtnText}>Share Results to WhatsApp</Text>
                                                        </>
                                                    }
                                                </TouchableOpacity>
                                            </>
                                        )}

                                        {/* Daily Leaderboard Toggle */}
                                        <TouchableOpacity
                                            style={[styles.endQuizBtn, { backgroundColor: dailyLeaderboardApproved ? COLORS.error : COLORS.primaryGold, marginTop: 12 }]}
                                            onPress={handleToggleLeaderboard}
                                            disabled={togglingLeaderboard}>
                                            {togglingLeaderboard ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <>
                                                    <Icon name={dailyLeaderboardApproved ? "eye-off" : "eye"} size={20} color="#FFF" />
                                                    <Text style={styles.endQuizBtnText}>
                                                        {dailyLeaderboardApproved ? 'Hide Daily Leaderboard' : 'Approve Daily Leaderboard'}
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        {/* Points Key */}
                                        <View style={styles.pointsKey}>
                                            <Text style={styles.pointsKeyTitle}>Points Distribution</Text>
                                            <View style={styles.pointsRow}>
                                                {[
                                                    { rank: '🥇 1st', pts: 10 },
                                                    { rank: '🥈 2nd', pts: 8 },
                                                    { rank: '🥉 3rd', pts: 6 },
                                                    { rank: '4th', pts: 5 },
                                                    { rank: '5th', pts: 4 },
                                                    { rank: 'Rest', pts: 1 },
                                                ].map(item => (
                                                    <View key={item.rank} style={styles.pointsItem}>
                                                        <Text style={styles.pointsItemRank}>{item.rank}</Text>
                                                        <Text style={styles.pointsItemPts}>{item.pts} pts</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    </>
                                )}
                            </View>
                        )}

                        {/* ───────── RESPONSES TABLE ───────── */}
                        {activeSection === 'responses' && (
                            <View>
                                {responses.length === 0 ? (
                                    <Text style={styles.emptyText}>No responses yet for this quiz.</Text>
                                ) : (
                                    <>
                                        {/* Table Header */}
                                        <View style={styles.tableHeader}>
                                            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Option</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Result</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Time</Text>
                                        </View>
                                        {responses.map((resp, idx) => {
                                            const optionText = activeQuiz?.options?.[resp.selectedIndex] || `Opt ${resp.selectedIndex + 1}`;
                                            return (
                                                <View
                                                    key={resp.id}
                                                    style={[
                                                        styles.tableRow,
                                                        idx % 2 === 0 && styles.tableRowAlt,
                                                    ]}>
                                                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                                                        {getUserName(resp.userId)}
                                                    </Text>
                                                    <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={1}>
                                                        {optionText}
                                                    </Text>
                                                    <Text style={[
                                                        styles.tableCell,
                                                        { flex: 0.7, color: resp.isCorrect ? COLORS.success : COLORS.error },
                                                    ]}>
                                                        {resp.isCorrect ? '✓' : '✗'}
                                                    </Text>
                                                    <Text style={[styles.tableCell, { flex: 1.5 }]}>
                                                        {formatTime(resp.submittedAt)}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </>
                                )}
                            </View>
                        )}

                        {/* ───────── CREATE QUIZ ───────── */}
                        {activeSection === 'create' && (
                            <View style={styles.createForm}>
                                <View style={styles.formHeaderRow}>
                                    <Text style={styles.formTitle}>New Daily Quiz</Text>
                                    <TouchableOpacity
                                        style={[styles.testModeToggle, isTestMode && styles.testModeToggleActive]}
                                        onPress={() => setIsTestMode(!isTestMode)}>
                                        <Text style={[styles.testModeText, isTestMode && styles.testModeTextActive]}>
                                            {isTestMode ? 'Test Mode: ON' : 'Test Mode: OFF'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Question..."
                                    value={newQuestion}
                                    onChangeText={setNewQuestion}
                                    placeholderTextColor={COLORS.lightBrown}
                                    multiline
                                />

                                {newOptions.map((opt, idx) => (
                                    <View key={idx} style={styles.optionRow}>
                                        <TouchableOpacity
                                            style={[styles.radioBtn, newCorrectIndex === idx && styles.radioBtnActive]}
                                            onPress={() => setNewCorrectIndex(idx)}>
                                            {newCorrectIndex === idx && <View style={styles.radioInner} />}
                                        </TouchableOpacity>
                                        <TextInput
                                            style={[styles.input, styles.optionInput]}
                                            placeholder={`Option ${idx + 1}`}
                                            value={opt}
                                            onChangeText={text => {
                                                const opts = [...newOptions];
                                                opts[idx] = text;
                                                setNewOptions(opts);
                                            }}
                                            placeholderTextColor={COLORS.lightBrown}
                                        />
                                    </View>
                                ))}

                                <View style={styles.dateRow}>
                                    <View style={styles.dateCol}>
                                        <Text style={styles.dateLabel}>Unlock Time</Text>
                                        <TouchableOpacity style={styles.dateBtn} onPress={() => setOpenUnlockPicker(true)}>
                                            <Icon name="calendar-clock" size={14} color={COLORS.primaryGold} />
                                            <Text style={styles.dateText}>
                                                {unlockTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </TouchableOpacity>
                                        <View style={styles.trueTimeBadge}>
                                            <Icon name="Information-outline" size={10} color={COLORS.success} />
                                            <Text style={styles.trueTimeText}>True Sync: {getServerTimePreview(unlockTime)}</Text>
                                        </View>
                                        <DatePicker
                                            modal
                                            open={openUnlockPicker}
                                            date={unlockTime}
                                            onConfirm={date => { setOpenUnlockPicker(false); setUnlockTime(date); }}
                                            onCancel={() => setOpenUnlockPicker(false)}
                                        />
                                    </View>
                                    <View style={styles.dateCol}>
                                        <Text style={styles.dateLabel}>End Time</Text>
                                        <TouchableOpacity style={styles.dateBtn} onPress={() => setOpenEndPicker(true)}>
                                            <Icon name="calendar-clock" size={14} color={COLORS.primaryGold} />
                                            <Text style={styles.dateText}>
                                                {endTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </TouchableOpacity>
                                        <View style={styles.trueTimeBadge}>
                                            <Icon name="information-outline" size={10} color={COLORS.success} />
                                            <Text style={styles.trueTimeText}>True Sync: {getServerTimePreview(endTime)}</Text>
                                        </View>
                                        <DatePicker
                                            modal
                                            open={openEndPicker}
                                            date={endTime}
                                            onConfirm={date => { setOpenEndPicker(false); setEndTime(date); }}
                                            onCancel={() => setOpenEndPicker(false)}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={handleCreateQuiz}
                                    disabled={creating}>
                                    {creating
                                        ? <ActivityIndicator color={COLORS.cardBackground} />
                                        : <Text style={styles.createBtnText}>Schedule Quiz</Text>}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ───────── MONTHLY CHALLENGE ───────── */}
                        {activeSection === 'marathon' && (
                            <View style={styles.createForm}>
                                <View style={styles.formHeaderRow}>
                                    <Text style={styles.formTitle}>Monthly Challenge Management</Text>
                                    <TouchableOpacity
                                        style={[styles.testModeToggle, isTestMode && styles.testModeToggleActive]}
                                        onPress={() => setIsTestMode(!isTestMode)}>
                                        <Text style={[styles.testModeText, isTestMode && styles.testModeTextActive]}>
                                            {isTestMode ? 'Test Mode: ON' : 'Test Mode: OFF'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={[styles.dateLabel, { marginBottom: SPACING.md }]}>
                                    Manage the monthly challenge event quizzes and certificate approval.
                                </Text>

                                <TouchableOpacity
                                    style={[styles.endQuizBtn, { backgroundColor: COLORS.success, marginTop: 0 }]}
                                    onPress={handleApproveCertificates}
                                    disabled={approvingCerts}>
                                    {approvingCerts ? (
                                        <ActivityIndicator color={COLORS.white} />
                                    ) : (
                                        <>
                                            <Icon name="certificate" size={18} color={COLORS.white} />
                                            <Text style={styles.endQuizBtnText}>Approve & Issue Certificates</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <View style={{ height: 1, backgroundColor: COLORS.beigeDark, marginVertical: SPACING.lg }} />

                                <Text style={styles.pointsKeyTitle}>Add Monthly Challenge Question</Text>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Day Number (20-29)"
                                    value={marathonDayNumber}
                                    onChangeText={setMarathonDayNumber}
                                    keyboardType="numeric"
                                    placeholderTextColor={COLORS.lightBrown}
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder="Question..."
                                    value={marathonQuestion}
                                    onChangeText={setMarathonQuestion}
                                    placeholderTextColor={COLORS.lightBrown}
                                    multiline
                                />

                                {marathonOptions.map((opt, idx) => (
                                    <View key={idx} style={styles.optionRow}>
                                        <TouchableOpacity
                                            style={[styles.radioBtn, marathonCorrectIndex === idx && styles.radioBtnActive]}
                                            onPress={() => setMarathonCorrectIndex(idx)}>
                                            {marathonCorrectIndex === idx && <View style={styles.radioInner} />}
                                        </TouchableOpacity>
                                        <TextInput
                                            style={[styles.input, styles.optionInput]}
                                            placeholder={`Option ${idx + 1}`}
                                            value={opt}
                                            onChangeText={text => {
                                                const opts = [...marathonOptions];
                                                opts[idx] = text;
                                                setMarathonOptions(opts);
                                            }}
                                            placeholderTextColor={COLORS.lightBrown}
                                        />
                                    </View>
                                ))}

                                <View style={styles.dateRow}>
                                    <View style={styles.dateCol}>
                                        <Text style={styles.dateLabel}>Unlock Time</Text>
                                        <TouchableOpacity style={styles.dateBtn} onPress={() => setOpenMarathonUnlockPicker(true)}>
                                            <Icon name="calendar-clock" size={14} color={COLORS.primaryGold} />
                                            <Text style={styles.dateText}>
                                                {marathonUnlockTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </TouchableOpacity>
                                        <DatePicker
                                            modal
                                            open={openMarathonUnlockPicker}
                                            date={marathonUnlockTime}
                                            onConfirm={date => { setOpenMarathonUnlockPicker(false); setMarathonUnlockTime(date); }}
                                            onCancel={() => setOpenMarathonUnlockPicker(false)}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={handleCreateMarathonQuestion}
                                    disabled={marathonCreating}>
                                    {marathonCreating
                                        ? <ActivityIndicator color={COLORS.cardBackground} />
                                        : <Text style={styles.createBtnText}>Schedule Question</Text>}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ───────── ARENA QUESTIONS (BULK) ───────── */}
                        {activeSection === 'arena' && (
                            <View style={styles.createForm}>
                                <Text style={styles.formTitle}>Arena Bulk Upload</Text>
                                <Text style={{ color: COLORS.lightBrown, marginBottom: 15, fontSize: FONT_SIZES.sm }}>
                                    Paste your JSON array below. Each question MUST have 'question' (English), 'questionRoman' (Roman Urdu), 'options' (Array of 4), and 'correctIndex' (0-3).
                                </Text>

                                <TextInput
                                    style={[styles.input, { height: 250, textAlignVertical: 'top' }]}
                                    placeholder='[{ "question": "...", "questionRoman": "...", "options": ["...", "..."], "correctIndex": 0 }, ...]'
                                    value={arenaJson}
                                    onChangeText={setArenaJson}
                                    placeholderTextColor={COLORS.lightBrown}
                                    multiline
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />

                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={handleBulkUploadArena}
                                    disabled={uploadingArena}>
                                    {uploadingArena
                                        ? <ActivityIndicator color={COLORS.cardBackground} />
                                        : (
                                            <>
                                                <Icon name="cloud-upload" size={18} color={COLORS.cardBackground} style={{ marginRight: 8 }} />
                                                <Text style={styles.createBtnText}>Validate & Upload to Arena</Text>
                                            </>
                                        )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.createBtn, { backgroundColor: COLORS.error, marginTop: 12 }]}
                                    onPress={handleDeleteAllArenaQuestions}
                                    disabled={uploadingArena}>
                                    {uploadingArena
                                        ? <ActivityIndicator color={COLORS.cardBackground} />
                                        : (
                                            <>
                                                <Icon name="delete-sweep" size={18} color={COLORS.cardBackground} style={{ marginRight: 8 }} />
                                                <Text style={styles.createBtnText}>Clear Arena Question Bank</Text>
                                            </>
                                        )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ───────── FIREBASE CLEANUP ───────── */}
                        {activeSection === 'duas' && (
                            <View style={styles.createForm}>
                                <Text style={styles.formTitle}>Firebase Cleanup</Text>
                                <Text style={{ color: COLORS.lightBrown, marginBottom: 20 }}>
                                    Remove unused duas documents and settle expired Arena records without changing the existing Firebase structure.
                                </Text>

                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={handleCleanupStorage}
                                    disabled={cleaningStorage}>
                                    {cleaningStorage
                                        ? <ActivityIndicator color={COLORS.cardBackground} />
                                        : <Text style={styles.createBtnText}>Run Firebase Cleanup</Text>}
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    offscreen: { position: 'absolute', top: -9999, left: -9999 },
    scrollContent: { padding: SPACING.xl, paddingBottom: 120 },
    title: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.hero, color: COLORS.darkBrown, marginTop: SPACING.xxl, marginBottom: SPACING.lg },
    noAccessText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.lg, color: COLORS.lightBrown, textAlign: 'center', marginTop: 80 },

    activeQuizBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.primaryGold + '18',
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primaryGold,
    },
    liveIndicator: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primaryGold,
    },
    activeQuizText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.sm, color: COLORS.darkBrown, flex: 1 },
    deletePillBtn: { padding: 4, marginLeft: 8 },

    sectionTabs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: 6,
        marginBottom: SPACING.xl,
        gap: 6,
        ...SHADOWS.card,
    },
    sectionTab: {
        width: '31.5%', // Approx 3 per row with gap
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    sectionTabActive: { backgroundColor: COLORS.primaryGold },
    sectionTabText: { ...TYPOGRAPHY.heading, fontSize: 10, color: COLORS.lightBrown, letterSpacing: 0.1 },
    sectionTabTextActive: { color: COLORS.cardBackground },

    statsGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    statCard: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.card },
    statCardCorrect: { borderTopWidth: 3, borderTopColor: COLORS.success },
    statCardWrong: { borderTopWidth: 3, borderTopColor: COLORS.error },
    statNumber: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.display, color: COLORS.primaryGold },
    statLabel: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown, marginTop: 2 },

    responderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.card,
    },
    responderInfo: { flex: 1 },
    responderLabel: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown },
    responderName: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.darkBrown },
    responderTime: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.xs, color: COLORS.primaryGold },

    endQuizBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.error,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.lg,
        marginTop: SPACING.lg,
        marginBottom: SPACING.lg,
        ...SHADOWS.elevated,
    },
    endQuizBtnText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.white },

    pointsKey: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        ...SHADOWS.card,
    },
    pointsKeyTitle: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.sm, color: COLORS.darkBrown, marginBottom: SPACING.md },
    pointsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    pointsItem: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.sm,
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        alignItems: 'center',
    },
    pointsItemRank: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown },
    pointsItemPts: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.sm, color: COLORS.primaryGold },

    // Table
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: COLORS.primaryGold,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.sm,
        marginBottom: 2,
    },
    tableHeaderCell: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.xs, color: COLORS.cardBackground },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.beigeDark,
    },
    tableRowAlt: { backgroundColor: COLORS.background },
    tableCell: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.xs, color: COLORS.darkBrown },

    // Create form
    createForm: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, ...SHADOWS.card },
    formHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    formTitle: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.lg, color: COLORS.darkBrown, marginBottom: 0 },
    testModeToggle: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.pill,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.beigeDark,
    },
    testModeToggleActive: {
        backgroundColor: COLORS.success + '15',
        borderColor: COLORS.success,
    },
    testModeText: { ...TYPOGRAPHY.heading, fontSize: 10, color: COLORS.lightBrown },
    testModeTextActive: { color: COLORS.success },
    input: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.darkBrown,
        borderWidth: 1,
        borderColor: COLORS.beigeDark,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    optionInput: { flex: 1, marginBottom: 0 },
    radioBtn: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, borderColor: COLORS.lightBrown,
        alignItems: 'center', justifyContent: 'center',
    },
    radioBtnActive: { borderColor: COLORS.primaryGold },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primaryGold },
    dateRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    dateCol: { flex: 1 },
    dateLabel: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown, marginBottom: 4 },
    dateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: COLORS.beigeDark,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.sm,
    },
    dateText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.xs, color: COLORS.darkBrown },
    trueTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    trueTimeText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs - 2,
        color: COLORS.success,
        fontStyle: 'italic',
    },
    createBtn: {
        backgroundColor: COLORS.primaryGold,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        ...SHADOWS.card,
    },
    createBtnText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.cardBackground },
    emptyText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.md, color: COLORS.lightBrown, textAlign: 'center', marginTop: 40 },
});
