import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QuizCard from '../components/home/QuizCard';
import { useAuth } from '../context/AuthContext';
import { firestoreService } from '../services/firebaseService';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, SPACING, TYPOGRAPHY } from '../theme';

function getServerAdjustedDateString(serverTimeOffset = 0) {
    const offset = typeof serverTimeOffset === 'number' ? serverTimeOffset : 0;
    const adjustedNow = new Date(Date.now() + offset);
    // Fallback to device date if adjustedNow is invalid
    if (isNaN(adjustedNow.getTime())) {
        return new Date().toISOString().split('T')[0];
    }
    return adjustedNow.toISOString().split('T')[0];
}

export default function DailyQuizScreen({ navigation, route }) {
    const { autoStart = false } = route.params || {};
    const { user, userRole, serverTimeOffset } = useAuth();
    const [loading, setLoading] = useState(true);
    const [quizStarted, setQuizStarted] = useState(autoStart);
    const [quizzes, setQuizzes] = useState([]);
    const [userResponses, setUserResponses] = useState({});

    const loadQuiz = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            const serverNow = Date.now() + (serverTimeOffset || 0);
            const unlocked = await firestoreService.getUnlockedQuizzes(serverNow, 3);
            setQuizzes(unlocked);
            const responses = await firestoreService.getUserQuizResponsesBatch(
                user.uid,
                unlocked.map(quiz => quiz.id),
            );
            setUserResponses(responses);
        } catch (error) {
            Alert.alert('Error', 'Unable to load the daily quiz.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadQuiz();
    }, [loadQuiz]);

    const featuredQuiz = useMemo(() => {
        if (!quizzes.length) return null;
        return quizzes[0];
    }, [quizzes]);

    const handleAnswer = useCallback(async (selectedIndex) => {
        if (!featuredQuiz || !user || userRole === 'admin' || userResponses[featuredQuiz.id]) {
            return;
        }

        const responseTime = 0;
        const isCorrect = selectedIndex === featuredQuiz.correctIndex;
        const todayDateString = getServerAdjustedDateString(serverTimeOffset);

        setUserResponses(prev => ({
            ...prev,
            [featuredQuiz.id]: { selectedIndex, isCorrect, responseTime },
        }));

        try {
            await firestoreService.submitQuizResponse(
                user.uid,
                featuredQuiz.id,
                selectedIndex,
                featuredQuiz.correctIndex,
                responseTime,
                todayDateString,
            );
        } catch (error) {
            Alert.alert('Error', 'Unable to save your answer.');
        }
    }, [featuredQuiz, serverTimeOffset, user, userResponses, userRole]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color={COLORS.darkBrown} />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Daily Quiz</Text>
                <Text style={styles.headerSubtitle}>Take a moment before you start today's quiz.</Text>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="small" color={COLORS.primaryGold} />
                        <Text style={styles.loadingText}>Loading today's quiz...</Text>
                    </View>
                ) : featuredQuiz ? (
                    <>
                        <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>Today's Quiz</Text>
                            <Text style={styles.previewCount}>1 Question</Text>
                            <Text style={styles.previewDescription}>Test your Islamic knowledge</Text>
                            {!quizStarted && (
                                <TouchableOpacity style={styles.startButton} onPress={() => setQuizStarted(true)}>
                                    <Text style={styles.startButtonText}>Start Quiz</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {quizStarted && (
                            <QuizCard
                                quiz={featuredQuiz}
                                userResponse={userResponses[featuredQuiz.id]}
                                isAdmin={userRole === 'admin'}
                                onAnswer={handleAnswer}
                            />
                        )}
                    </>
                ) : (
                    <View style={styles.emptyWrap}>
                        <Icon name="book-open-page-variant-outline" size={34} color={COLORS.lightBrown} />
                        <Text style={styles.loadingText}>No daily quiz is available right now.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: SPACING.xl,
        paddingBottom: 120,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: SPACING.sm,
        marginTop: SPACING.xxl,
        marginBottom: SPACING.md,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    backButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.darkBrown,
    },
    headerTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.hero,
        color: COLORS.darkBrown,
    },
    headerSubtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginTop: SPACING.sm,
        marginBottom: SPACING.xl,
    },
    loadingWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    loadingText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginTop: SPACING.md,
        textAlign: 'center',
    },
    previewCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
        marginBottom: SPACING.lg,
        ...SHADOWS.card,
    },
    previewLabel: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xxl,
        color: COLORS.darkBrown,
    },
    previewCount: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.primaryGold,
        marginTop: SPACING.md,
    },
    previewDescription: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        marginTop: SPACING.sm,
    },
    startButton: {
        marginTop: SPACING.xl,
        backgroundColor: COLORS.primaryGold,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    startButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.white,
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xxl,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
    },
});
