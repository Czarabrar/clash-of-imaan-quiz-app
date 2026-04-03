/**
 * Monthly challenge screen for Ramazan event quizzes.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
    Platform,
    Share,
    KeyboardAvoidingView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker from 'react-native-date-picker';
import ViewShot from 'react-native-view-shot';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { CertificateShareCard } from '../components/CertificateShareCard';
import { useCertificateShare } from '../hooks/useCertificateShare';

export default function MarathonScreen({ navigation }) {
    const { user, userRole, userProfile } = useAuth();
    const isAdmin = userRole === 'admin';
    const { shareRef: certRef, sharing: sharingCert, captureAndShare: shareCertificate } = useCertificateShare();

    // Marathon questions
    const [questions, setQuestions] = useState([]);
    const [myResponses, setMyResponses] = useState({}); // { questionId: { selectedIndex, isCorrect } }
    const [loading, setLoading] = useState(true);

    // Approval state
    const [marathonApproved, setMarathonApproved] = useState(false);
    const [userEligible, setUserEligible] = useState(false);
    const [approvingCerts, setApprovingCerts] = useState(false);
    const [generatingPDF, setGeneratingPDF] = useState(false);

    // Admin: Add question form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '', '', '']);
    const [newCorrectIndex, setNewCorrectIndex] = useState(0);
    const [newDayNumber, setNewDayNumber] = useState('20');
    const [unlockTime, setUnlockTime] = useState(new Date());
    const [openPicker, setOpenPicker] = useState(false);
    const [creating, setCreating] = useState(false);

    // Load marathon settings
    useEffect(() => {
        const unsubSettings = firestore()
            .collection('meta')
            .doc('marathonSettings')
            .onSnapshot(snap => {
                if (snap.exists) {
                    const data = snap.data();
                    setMarathonApproved(data?.approved === true);
                } else {
                    setMarathonApproved(false);
                }
            }, err => {
            });
        return () => unsubSettings();
    }, []);

    // Load user eligibility from Firestore (live)
    useEffect(() => {
        if (!user) return;
        const unsubUser = firestore()
            .collection('users')
            .doc(user.uid)
            .onSnapshot(snap => {
                if (snap.exists) {
                    setUserEligible(
                        snap.data().monthlyChallengeEligible === true ||
                        snap.data().marathonEligible === true,
                    );
                }
            });
        return () => unsubUser();
    }, [user]);

    // Load marathon questions
    useEffect(() => {
        const unsub = firestore()
            .collection('marathonQuizzes')
            .orderBy('dayNumber', 'asc')
            .onSnapshot(snap => {
                if (!snap) return;
                const now = new Date();
                const all = snap.docs.map(d => {
                    const data = d.data();
                    let status = data.status;

                    // Auto-unlock if time has passed
                    if (status === 'scheduled' && data.unlockTime && data.unlockTime.toDate() <= now) {
                        status = 'live';
                    }

                    return { id: d.id, ...data, status };
                });

                // Show all questions to everyone so they know what's coming
                setQuestions(all);
                setLoading(false);
            });
        return () => unsub();
    }, []);

    // Load my responses
    useEffect(() => {
        if (!user) return;
        const unsub = firestore()
            .collection('marathonResponses')
            .where('userId', '==', user.uid)
            .onSnapshot(snap => {
                if (!snap) return;
                const map = {};
                snap.docs.forEach(d => {
                    const data = d.data();
                    map[data.questionId] = {
                        selectedIndex: data.selectedIndex,
                        isCorrect: data.isCorrect,
                    };
                });
                setMyResponses(map);
            });
        return () => unsub();
    }, [user]);

    const handleAnswer = async (questionId, selectedIndex, correctIndex) => {
        if (myResponses[questionId] !== undefined) return; // already answered
        if (isAdmin) return; // admin cannot answer

        const isCorrect = selectedIndex === correctIndex;
        // Optimistic update
        setMyResponses(prev => ({ ...prev, [questionId]: { selectedIndex, isCorrect } }));

        try {
            await firestore().collection('marathonResponses').add({
                userId: user.uid,
                questionId,
                selectedIndex,
                isCorrect,
                submittedAt: firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {
            if (__DEV__) console.error('Marathon answer error:', e);
            setMyResponses(prev => {
                const updated = { ...prev };
                delete updated[questionId];
                return updated;
            });
            Alert.alert('Error', 'Could not save your answer.');
        }
    };

    // Admin: Approve Certificates
    const handleApproveCertificates = async () => {
        setApprovingCerts(true);
        try {
            // Fetch all marathon responses grouped by user
            const allResponses = await firestore().collection('marathonResponses').get();
            const totalQuestions = questions.length;

            // Count correct per user
            const userCorrect = {};
            allResponses.docs.forEach(d => {
                const data = d.data();
                if (!userCorrect[data.userId]) userCorrect[data.userId] = 0;
                if (data.isCorrect) userCorrect[data.userId]++;
            });

            const batch = firestore().batch();
            const PASS_THRESHOLD = 0.6; // 60%

            Object.entries(userCorrect).forEach(([uid, correctCount]) => {
                const userRef = firestore().collection('users').doc(uid);
                batch.update(userRef, {
                    marathonEligible: true,
                    monthlyChallengeEligible: true,
                });
            });

            // Enable certificate downloads
            const settingsRef = firestore().collection('meta').doc('marathonSettings');
            batch.set(settingsRef, { approved: true, approvedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });

            await batch.commit();

            Alert.alert('Done', 'Certificates enabled for all participants!');
        } catch (e) {
            if (__DEV__) console.error('Approve error:', e);
            Alert.alert('Error', 'Could not approve certificates: ' + e.message);
        } finally {
            setApprovingCerts(false);
        }
    };

    // Certificate data
    const certUserName = userProfile?.name || user?.displayName || 'Participant';
    const certAnsweredKeys = Object.keys(myResponses);
    const certCorrectCount = certAnsweredKeys.filter(k => myResponses[k]?.isCorrect).length;
    const certPercentage = questions.length > 0
        ? Math.round((certCorrectCount / questions.length) * 100)
        : 0;

    // Admin: Create marathon question
    const handleCreateQuestion = async () => {
        if (!newQuestion.trim() || newOptions.some(o => !o.trim())) {
            Alert.alert('Missing Fields', 'Fill in question and all 4 options.');
            return;
        }
        setCreating(true);
        try {
            await firestore().collection('marathonQuizzes').add({
                question: newQuestion.trim(),
                options: newOptions.map(o => o.trim()),
                correctIndex: newCorrectIndex,
                dayNumber: parseInt(newDayNumber, 10) || 20,
                unlockTime: firestore.Timestamp.fromDate(unlockTime),
                status: 'scheduled',
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
            Alert.alert('Success', 'Monthly challenge question created!');
            setNewQuestion('');
            setNewOptions(['', '', '', '']);
            setNewCorrectIndex(0);
            setShowAddForm(false);
        } catch (e) {
            if (__DEV__) console.error('Create monthly challenge question error:', e);
            Alert.alert('Error', 'Failed to create question.');
        } finally {
            setCreating(false);
        }
    };

    const myAnsweredCount = Object.keys(myResponses).length;
    const myCorrectCount = Object.keys(myResponses).filter(k => myResponses[k]?.isCorrect).length;
    const myPct = questions.length > 0 ? Math.round((myCorrectCount / questions.length) * 100) : 0;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">

                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color={COLORS.darkBrown} />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>🌙 Lailatul Qadr Challenge</Text>
                    <Text style={styles.subtitle}>Special Ramadan challenge · Earn certificate</Text>
                </View>

                {/* Explanation Block */}
                <View style={styles.explanationCard}>
                    <Icon name="information-outline" size={18} color={COLORS.primaryGold} />
                    <Text style={styles.explanationText}>
                        Answer one question daily for 10 days. Score 60% or more to receive your official certificate InshaAllah.
                    </Text>
                </View>

                {isAdmin && (
                    <View style={styles.adminPreviewCard}>
                        <View style={styles.adminPreviewHeader}>
                            <Icon name="eye-outline" size={18} color={COLORS.primaryGold} />
                            <Text style={styles.adminPreviewTitle}>Admin Preview</Text>
                        </View>
                        <Text style={styles.adminPreviewText}>
                            {questions.length > 0
                                ? `Showing ${questions.length} challenge question${questions.length > 1 ? 's' : ''} below.`
                                : 'No challenge questions yet. Add your first Lailatul Qadr question below.'}
                        </Text>
                    </View>
                )}

                {/* User Progress Bar */}
                {!isAdmin && (
                    <View style={styles.progressCard}>
                        <View style={styles.progressRow}>
                            <Text style={styles.progressLabel}>Your Score</Text>
                            <Text style={styles.progressPct}>{myPct}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${myPct}%` }]} />
                        </View>
                        <Text style={styles.progressSub}>
                            {myCorrectCount} correct · {myAnsweredCount}/{questions.length} answered · Pass at 60%
                        </Text>
                    </View>
                )}

                {/* Certificate Download */}
                {!isAdmin && marathonApproved && userEligible && (
                    <>
                        {/* Hidden off-screen certificate card */}
                        <ViewShot
                            ref={certRef}
                            options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}
                            style={styles.offscreen}>
                            <CertificateShareCard
                                userName={certUserName}
                                percentage={certPercentage}
                                totalQuestions={questions.length}
                                correctCount={certCorrectCount}
                            />
                        </ViewShot>

                        <TouchableOpacity
                            style={styles.certBtn}
                            onPress={shareCertificate}
                            disabled={sharingCert}>
                            {sharingCert
                                ? <ActivityIndicator color={COLORS.cardBackground} />
                                : (
                                    <>
                                        <Icon name="certificate" size={20} color={COLORS.cardBackground} />
                                        <Text style={styles.certBtnText}>📥 Share Certificate</Text>
                                    </>
                                )}
                        </TouchableOpacity>
                    </>
                )}

                {/* Pending approval notice */}
                {!isAdmin && !marathonApproved && myAnsweredCount > 0 && (
                    <View style={styles.pendingBanner}>
                        <Icon name="clock-outline" size={14} color={COLORS.primaryGold} />
                        <Text style={styles.pendingText}>
                            Certificates are pending admin approval
                        </Text>
                    </View>
                )}

                {/* Admin: Approve Certificates */}
                {isAdmin && (
                    <TouchableOpacity
                        style={styles.approveCertBtn}
                        onPress={handleApproveCertificates}
                        disabled={approvingCerts}>
                        {approvingCerts
                            ? <ActivityIndicator color={COLORS.white} />
                            : (
                                <>
                                    <Icon name="check-decagram" size={18} color={COLORS.white} />
                                    <Text style={styles.approveCertBtnText}>
                                        {marathonApproved ? '✓ Re-Approve Certificates' : 'Approve Certificates'}
                                    </Text>
                                </>
                            )}
                    </TouchableOpacity>
                )}

                {/* Admin: Add Question Toggle */}
                {isAdmin && (
                    <TouchableOpacity
                        style={styles.addQuestionBtn}
                        onPress={() => setShowAddForm(!showAddForm)}>
                        <Icon name={showAddForm ? 'close-circle-outline' : 'plus-circle-outline'} size={16} color={COLORS.cardBackground} />
                        <Text style={styles.addQuestionBtnText}>
                            {showAddForm ? 'Cancel' : 'Add Monthly Challenge Question'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Admin: Add Question Form */}
                {isAdmin && showAddForm && (
                    <View style={styles.createForm}>
                        <Text style={styles.formTitle}>New Monthly Challenge Question</Text>

                        <View style={styles.dayRow}>
                            <Text style={styles.dayLabel}>Day Number (20–29)</Text>
                            <TextInput
                                style={styles.dayInput}
                                keyboardType="numeric"
                                value={newDayNumber}
                                onChangeText={setNewDayNumber}
                                placeholder="20"
                                placeholderTextColor={COLORS.lightBrown}
                            />
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

                        <Text style={styles.dayLabel}>Unlock Time</Text>
                        <TouchableOpacity style={styles.dateBtn} onPress={() => setOpenPicker(true)}>
                            <Icon name="calendar-clock" size={14} color={COLORS.primaryGold} />
                            <Text style={styles.dateText}>
                                {unlockTime.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                        <DatePicker
                            modal
                            open={openPicker}
                            date={unlockTime}
                            onConfirm={date => { setOpenPicker(false); setUnlockTime(date); }}
                            onCancel={() => setOpenPicker(false)}
                        />

                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={handleCreateQuestion}
                            disabled={creating}>
                            {creating
                                ? <ActivityIndicator color={COLORS.cardBackground} />
                                : <Text style={styles.createBtnText}>Add Question</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Questions List */}
                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.primaryGold} style={{ marginTop: 40 }} />
                ) : questions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon name="flag-checkered" size={48} color={COLORS.beigeDark} />
                        <Text style={styles.emptyText}>
                            {isAdmin ? 'No monthly challenge questions yet. Add one above.' : 'Monthly challenge questions coming soon!'}
                        </Text>
                    </View>
                ) : (
                    questions.map((q, qIdx) => {
                        const response = myResponses[q.id];
                        const answered = response !== undefined;

                        return (
                            <View key={q.id} style={styles.questionCard}>
                                {/* Day badge */}
                                <View style={styles.dayBadge}>
                                    <Text style={styles.dayBadgeText}>Day {q.dayNumber}</Text>
                                    {isAdmin && (
                                        <View style={[styles.statusBadge, { backgroundColor: q.status === 'live' ? COLORS.success : q.status === 'ended' ? COLORS.lightBrown : COLORS.primaryGold }]}>
                                            <Text style={styles.statusBadgeText}>{q.status}</Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.questionText}>{q.question}</Text>

                                {isAdmin && (
                                    <View style={styles.adminQuizNote}>
                                        <Icon name="shield-account" size={12} color={COLORS.lightBrown} />
                                        <Text style={styles.adminQuizNoteText}>Admin view only</Text>
                                    </View>
                                )}

                                {!isAdmin && q.status === 'scheduled' && (
                                    <View style={styles.lockedContainer}>
                                        <Icon name="lock" size={24} color={COLORS.beigeDark} />
                                        <Text style={styles.lockedText}>
                                            Unlocks at {q.unlockTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'soon'}
                                        </Text>
                                    </View>
                                )}

                                {!isAdmin && q.status !== 'scheduled' && (
                                    <View style={styles.optionsContainer}>
                                        {(q.options || []).map((option, idx) => {
                                            const isSelected = response?.selectedIndex === idx;
                                            const isCorrect = answered && idx === q.correctIndex;
                                            const isWrong = answered && isSelected && idx !== q.correctIndex;

                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.option,
                                                        isSelected && styles.optionSelected,
                                                        isCorrect && answered && styles.optionCorrect,
                                                        isWrong && styles.optionWrong,
                                                    ]}
                                                    onPress={() => handleAnswer(q.id, idx, q.correctIndex)}
                                                    disabled={answered}
                                                    activeOpacity={0.75}>
                                                    <View style={[
                                                        styles.radio,
                                                        isSelected && styles.radioSelected,
                                                        isCorrect && answered && styles.radioCorrect,
                                                    ]}>
                                                        {isSelected && <View style={styles.radioInnerFill} />}
                                                    </View>
                                                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                                        {option}
                                                    </Text>
                                                    {isCorrect && answered && (
                                                        <Icon name="check-circle" size={16} color={COLORS.success} />
                                                    )}
                                                    {isWrong && (
                                                        <Icon name="close-circle" size={16} color={COLORS.error} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}

                                {answered && !isAdmin && (
                                    <View style={styles.answeredBadge}>
                                        <Icon
                                            name={response.isCorrect ? 'check-circle-outline' : 'close-circle-outline'}
                                            size={14}
                                            color={response.isCorrect ? COLORS.success : COLORS.error}
                                        />
                                        <Text style={[styles.answeredText, { color: response.isCorrect ? COLORS.success : COLORS.error }]}>
                                            {response.isCorrect ? 'Correct!' : 'Incorrect'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { padding: SPACING.xl, paddingBottom: 120 },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: SPACING.xs,
        marginTop: SPACING.xxl,
        marginBottom: SPACING.md,
        padding: SPACING.sm,
    },
    backButtonText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.sm, color: COLORS.darkBrown },
    header: { marginBottom: SPACING.lg },
    title: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.hero, color: COLORS.darkBrown },
    subtitle: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.sm, color: COLORS.lightBrown, marginTop: 2 },
    offscreen: { position: 'absolute', top: -9999, left: -9999 },
    adminPreviewCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
        ...SHADOWS.card,
    },
    adminPreviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    adminPreviewTitle: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.darkBrown },
    adminPreviewText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.sm, color: COLORS.lightBrown, lineHeight: 20 },

    explanationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primaryGold,
        gap: SPACING.sm,
        ...SHADOWS.card,
    },
    explanationText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.darkBrown,
        flex: 1,
        lineHeight: 20,
    },

    progressCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.lg,
        ...SHADOWS.card,
    },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
    progressLabel: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.sm, color: COLORS.lightBrown },
    progressPct: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.xl, color: COLORS.primaryGold },
    progressTrack: { height: 8, backgroundColor: COLORS.beigeDark, borderRadius: 4, marginBottom: SPACING.sm },
    progressFill: { height: '100%', backgroundColor: COLORS.primaryGold, borderRadius: 4 },
    progressSub: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown },

    certBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.success,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.lg,
        marginBottom: SPACING.lg,
        ...SHADOWS.elevated,
    },
    certBtnText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.cardBackground },

    pendingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.primaryGold + '18',
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
    },
    pendingText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.sm, color: COLORS.primaryGold },

    approveCertBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.darkBrown,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.elevated,
    },
    approveCertBtnText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.white },

    addQuestionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.primaryGold,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.md,
        marginBottom: SPACING.lg,
        ...SHADOWS.card,
    },
    addQuestionBtnText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.sm, color: COLORS.cardBackground },

    createForm: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        marginBottom: SPACING.xl,
        ...SHADOWS.card,
    },
    formTitle: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.lg, color: COLORS.darkBrown, marginBottom: SPACING.lg },
    dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
    dayLabel: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown, marginBottom: 4 },
    dayInput: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        borderWidth: 1,
        borderColor: COLORS.beigeDark,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        width: 80,
        textAlign: 'center',
    },
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
    dateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: COLORS.beigeDark,
        borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    dateText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.xs, color: COLORS.darkBrown },
    createBtn: { backgroundColor: COLORS.primaryGold, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
    createBtnText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.md, color: COLORS.cardBackground },

    questionCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        marginBottom: SPACING.lg,
        ...SHADOWS.card,
    },
    dayBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
    dayBadgeText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.xs, color: COLORS.primaryGold, letterSpacing: 1 },
    statusBadge: {
        paddingHorizontal: SPACING.sm, paddingVertical: 2,
        borderRadius: BORDER_RADIUS.pill,
    },
    statusBadgeText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.xs, color: COLORS.white },
    questionText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
        lineHeight: 24,
        marginBottom: SPACING.lg,
    },
    adminQuizNote: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    adminQuizNoteText: { ...TYPOGRAPHY.caption, fontSize: FONT_SIZES.xs, color: COLORS.lightBrown },
    optionsContainer: { gap: SPACING.md },
    option: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.beigeDark,
        backgroundColor: COLORS.cardBackground,
    },
    optionSelected: { borderColor: COLORS.primaryGold, backgroundColor: '#FBF5E6' },
    optionCorrect: { borderColor: COLORS.success, backgroundColor: '#F0F5EC' },
    optionWrong: { borderColor: COLORS.error, backgroundColor: '#F5ECEC' },
    radio: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, borderColor: COLORS.darkBrown,
        alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
    },
    radioSelected: { borderColor: COLORS.primaryGold },
    radioCorrect: { borderColor: COLORS.success },
    radioInnerFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primaryGold },
    optionText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.md, color: COLORS.darkBrown, flex: 1 },
    optionTextSelected: { fontWeight: '600' },
    answeredBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: SPACING.lg, paddingTop: SPACING.md,
        borderTopWidth: 1, borderTopColor: COLORS.beigeDark,
    },
    answeredText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.sm },
    emptyContainer: { alignItems: 'center', marginTop: 60, gap: SPACING.md },
    emptyText: { ...TYPOGRAPHY.body, fontSize: FONT_SIZES.md, color: COLORS.lightBrown, textAlign: 'center' },
    lockedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.beigeDark,
        borderStyle: 'dashed',
        gap: SPACING.sm,
    },
    lockedText: { ...TYPOGRAPHY.heading, fontSize: FONT_SIZES.sm, color: COLORS.lightBrown },
});
