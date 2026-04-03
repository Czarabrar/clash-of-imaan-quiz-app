/**
 * Leaderboard Screen — Today (from quizResponses) and Overall tabs
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ViewShot from 'react-native-view-shot';
import firestore from '@react-native-firebase/firestore';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useUsersContext } from '../context/UsersContext';
import { LeaderboardShareCard } from '../components/LeaderboardShareCard';
import { useLeaderboardShare } from '../hooks/useLeaderboardShare';

export default function LeaderboardScreen() {
    const [activeTab, setActiveTab] = useState('overall');
    const { users: overallUsers, loadingUsers: loading, refreshUsers } = useUsersContext();
    const { shareRef, sharing, captureAndShare } = useLeaderboardShare();
    const [refreshing, setRefreshing] = useState(false);

    // Today leaderboard state
    const [todayUsers, setTodayUsers] = useState([]);
    const [todayLoading, setTodayLoading] = useState(false);
    const [activeQuizId, setActiveQuizId] = useState(null);

    // Admin Approval State
    const [isTodayApproved, setIsTodayApproved] = useState(false);

    useEffect(() => {
        const unsub = firestore()
            .collection('meta')
            .doc('dailyLeaderboard')
            .onSnapshot(doc => {
                if (doc && doc.exists) {
                    setIsTodayApproved(doc.data()?.approved || false);
                } else {
                    setIsTodayApproved(false);
                }
            });
        return () => unsub();
    }, []);

    // Fetch the latest active quiz and its responses
    const fetchTodayLeaderboard = useCallback(async () => {
        setTodayLoading(true);
        try {
            // Define today's midnight boundary
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const todayTimestamp = firestore.Timestamp.fromDate(todayMidnight);

            // Get quizzes created today only
            const quizSnap = await firestore()
                .collection('quizzes')
                .where('createdAt', '>=', todayTimestamp)
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();

            if (quizSnap.empty) {
                setTodayUsers([]);
                setTodayLoading(false);
                return;
            }

            // Find the most recently active quiz (prefer live, fallback to latest)
            let activeQuiz = quizSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .find(q => q.status !== 'ended');
            if (!activeQuiz) {
                activeQuiz = { id: quizSnap.docs[0].id, ...quizSnap.docs[0].data() };
            }
            setActiveQuizId(activeQuiz.id);

            // Fetch ALL responses for this quiz by quizId only (no composite index required)
            const responseSnap = await firestore()
                .collection('quizResponses')
                .where('quizId', '==', activeQuiz.id)
                .get();

            // Filter correct and sort by submittedAt in JS
            const correctDocs = responseSnap.docs
                .filter(d => d.data().isCorrect === true)
                .sort((a, b) => {
                    const tA = a.data().submittedAt?.toMillis?.() ?? 0;
                    const tB = b.data().submittedAt?.toMillis?.() ?? 0;
                    return tA - tB;
                });

            if (correctDocs.length === 0) {
                setTodayUsers([]);
                setTodayLoading(false);
                return;
            }

            // Use UsersContext to avoid redundant Firestore reads
            const userMap = {};
            overallUsers.forEach(u => {
                userMap[u.id] = u;
            });

            const enriched = correctDocs.map((doc, index) => {
                const data = doc.data();
                const userData = userMap[data.userId] || {};
                const submittedAt = data.submittedAt?.toDate?.();
                return {
                    id: doc.id,
                    userId: data.userId,
                    name: userData.name || 'Unknown',
                    avatar: userData.name ? userData.name.charAt(0).toUpperCase() : '?',
                    rank: index + 1,
                    submittedAt,
                    timeLabel: submittedAt
                        ? submittedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '--:--',
                    totalPoints: index === 0 ? 10 : index === 1 ? 8 : index === 2 ? 6 : index === 3 ? 5 : index === 4 ? 4 : 1,
                };
            });

            setTodayUsers(enriched);
        } catch (err) {
            if (__DEV__) console.error('Leaderboard fetchToday error:', err);
            setTodayUsers([]);
        } finally {
            setTodayLoading(false);
        }
    }, [overallUsers]);

    useEffect(() => {
        if (activeTab === 'today') {
            fetchTodayLeaderboard();
        }
    }, [activeTab, fetchTodayLeaderboard]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (activeTab === 'overall') {
            await refreshUsers();
        } else {
            await fetchTodayLeaderboard();
        }
        setRefreshing(false);
    }, [activeTab, refreshUsers, fetchTodayLeaderboard]);

    // Active Data based on Tab
    const data = activeTab === 'overall' ? overallUsers : todayUsers;
    const isLoading = activeTab === 'overall' ? loading : todayLoading;



    const topThree = data.slice(0, 3);
    const rest = data.slice(3);

    const getScoreLabel = (player) => {
        if (activeTab === 'today') {
            return player.timeLabel || '--:--';
        }
        return `${player.totalPoints || 0} pts`;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primaryGold}
                        colors={[COLORS.primaryGold]}
                    />
                }>
                <Text style={styles.title}>Leaderboard</Text>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'today' && styles.tabActive]}
                        onPress={() => setActiveTab('today')}>
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'today' && styles.tabTextActive,
                            ]}>
                            Today
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'overall' && styles.tabActive]}
                        onPress={() => setActiveTab('overall')}>
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'overall' && styles.tabTextActive,
                            ]}>
                            Overall
                        </Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'today' && (
                    <View style={styles.quizInfoBanner}>
                        <Icon name="trophy-outline" size={14} color={COLORS.primaryGold} />
                        <Text style={styles.quizInfoText}>
                            Ranked by correct answer · earliest first
                        </Text>
                    </View>
                )}

                {activeTab === 'today' && !isTodayApproved ? (
                    <View style={styles.lockedContainer}>
                        <Icon name="lock-clock" size={48} color={COLORS.lightBrown} />
                        <Text style={styles.lockedTitle}>Pending Results</Text>
                        <Text style={styles.lockedDesc}>Today's ranking is being calculated and will be revealed shortly.</Text>
                    </View>
                ) : isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.primaryGold} style={{ marginTop: 50 }} />
                ) : data.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Icon name="trophy-outline" size={48} color={COLORS.beigeDark} />
                        <Text style={{ color: COLORS.lightBrown, fontSize: FONT_SIZES.md, marginTop: SPACING.md }}>
                            {activeTab === 'today' ? 'No correct answers yet for today\'s quiz' : 'No data available yet'}
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Top 3 */}
                        <View style={styles.topThreeContainer}>
                            {/* 2nd place */}
                            {topThree[1] && (
                                <View style={styles.topItem}>
                                    <View style={[styles.topAvatar, styles.topAvatarSecond]}>
                                        <Text style={styles.topAvatarText}>{topThree[1].avatar}</Text>
                                    </View>
                                    <Text style={styles.topRank}>2</Text>
                                    <Text style={styles.topName} numberOfLines={1}>
                                        {topThree[1].name.split(' ')[0]}
                                    </Text>
                                    <Text style={styles.topScore}>{getScoreLabel(topThree[1])}</Text>
                                </View>
                            )}

                            {/* 1st place */}
                            {topThree[0] && (
                                <View style={[styles.topItem, styles.topItemFirst]}>
                                    <Icon
                                        name="crown"
                                        size={22}
                                        color={COLORS.primaryGold}
                                        style={styles.crown}
                                    />
                                    <View style={[styles.topAvatar, styles.topAvatarFirst]}>
                                        <Text style={[styles.topAvatarText, styles.topAvatarTextFirst]}>
                                            {topThree[0].avatar}
                                        </Text>
                                    </View>
                                    <Text style={[styles.topRank, styles.topRankFirst]}>1</Text>
                                    <Text style={styles.topName} numberOfLines={1}>
                                        {topThree[0].name.split(' ')[0]}
                                    </Text>
                                    <Text style={[styles.topScore, styles.topScoreFirst]}>
                                        {getScoreLabel(topThree[0])}
                                    </Text>
                                </View>
                            )}

                            {/* 3rd place */}
                            {topThree[2] && (
                                <View style={styles.topItem}>
                                    <View style={[styles.topAvatar, styles.topAvatarThird]}>
                                        <Text style={styles.topAvatarText}>{topThree[2].avatar}</Text>
                                    </View>
                                    <Text style={styles.topRank}>3</Text>
                                    <Text style={styles.topName} numberOfLines={1}>
                                        {topThree[2].name.split(' ')[0]}
                                    </Text>
                                    <Text style={styles.topScore}>{getScoreLabel(topThree[2])}</Text>
                                </View>
                            )}
                        </View>

                        {/* Rest of leaderboard (2 columns) */}
                        <View style={styles.gridContainer}>
                            {rest.map((player, index) => (
                                <View key={player.id || player.userId} style={styles.gridCard}>
                                    <Text style={styles.gridRank}>{index + 4}</Text>
                                    <View style={styles.gridAvatar}>
                                        <Text style={styles.gridAvatarText}>{player.avatar}</Text>
                                    </View>
                                    <View style={styles.gridInfo}>
                                        <Text style={styles.gridName} numberOfLines={1}>{player.name}</Text>
                                        {activeTab === 'overall' && player.streak !== undefined && (
                                            <View style={styles.streakBadge}>
                                                <Icon name="fire" size={12} color={COLORS.primaryGold} />
                                                <Text style={[styles.streakText, { fontSize: FONT_SIZES.xs - 2 }]}>{player.streak}</Text>
                                            </View>
                                        )}
                                        {activeTab === 'today' && (
                                            <Text style={[styles.streakText, { fontSize: FONT_SIZES.xs - 1 }]} numberOfLines={1}>{player.timeLabel}</Text>
                                        )}
                                    </View>
                                    <Text style={styles.gridScore}>
                                        {activeTab === 'today' ? `#${player.rank}` : `${player.totalPoints || 0}`}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* Hidden off-screen leaderboard card for capture */}
                {data.length > 0 && (
                    <ViewShot
                        ref={shareRef}
                        options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 3000 }}
                        style={styles.offscreen}>
                        <LeaderboardShareCard
                            topThree={topThree}
                            remaining={rest}
                            variant={activeTab === 'today' ? 'daily' : 'overall'}
                        />
                    </ViewShot>
                )}

                {/* Share Button */}
                {data.length > 0 && (
                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={captureAndShare}
                        disabled={sharing}>
                        {sharing
                            ? <ActivityIndicator size="small" color={COLORS.white} />
                            : <>
                                <Icon name="share-variant" size={18} color={COLORS.cardBackground} />
                                <Text style={styles.shareButtonText}>Share to WhatsApp</Text>
                            </>
                        }
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    lockedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.xxxl,
        paddingHorizontal: SPACING.xl,
    },
    lockedTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
        marginTop: SPACING.md,
    },
    lockedDesc: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        textAlign: 'center',
        marginTop: SPACING.xs,
        lineHeight: 20,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    offscreen: {
        position: 'absolute',
        top: -9999,
        left: -9999,
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
        marginBottom: SPACING.md,
        ...SHADOWS.card,
    },
    tab: {
        flex: 1,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.pill,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: COLORS.primaryGold,
    },
    tabText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        letterSpacing: 1,
    },
    tabTextActive: {
        color: COLORS.cardBackground,
    },
    quizInfoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: SPACING.lg,
        paddingHorizontal: SPACING.sm,
    },
    quizInfoText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        color: COLORS.lightBrown,
        letterSpacing: 0.3,
    },
    topThreeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginBottom: SPACING.xxl,
        paddingHorizontal: SPACING.md,
    },
    topItem: {
        alignItems: 'center',
        flex: 1,
    },
    topItemFirst: {
        marginBottom: SPACING.lg,
    },
    crown: {
        marginBottom: SPACING.xs,
    },
    topAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xs,
        borderWidth: 2,
    },
    topAvatarFirst: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderColor: COLORS.primaryGold,
        backgroundColor: COLORS.primaryGold + '15',
    },
    topAvatarSecond: {
        borderColor: COLORS.lightBrown,
        backgroundColor: COLORS.lightBrown + '15',
    },
    topAvatarThird: {
        borderColor: COLORS.lightBrown,
        backgroundColor: COLORS.lightBrown + '10',
    },
    topAvatarText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
    },
    topAvatarTextFirst: {
        fontSize: FONT_SIZES.hero,
        color: COLORS.primaryGold,
    },
    topRank: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
    },
    topRankFirst: {
        color: COLORS.primaryGold,
        fontSize: FONT_SIZES.md,
    },
    topName: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.darkBrown,
        marginTop: 2,
    },
    topScore: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xs,
        color: COLORS.lightBrown,
        marginTop: 2,
    },
    topScoreFirst: {
        color: COLORS.primaryGold,
        fontSize: FONT_SIZES.sm,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginTop: 2,
    },
    streakText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        color: COLORS.primaryGold,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.creamBorder + '50',
        ...SHADOWS.card,
    },
    gridRank: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        width: 32,
        textAlign: 'center',
    },
    gridAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.primaryGold + '10',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    gridAvatarText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xs,
        color: COLORS.primaryGold,
    },
    gridInfo: {
        flex: 1,
        marginRight: SPACING.xs,
    },
    gridName: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.darkBrown,
    },
    gridScore: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.primaryGold,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.lg,
        marginTop: SPACING.xl,
        gap: SPACING.sm,
        ...SHADOWS.card,
    },
    shareButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.white,
        letterSpacing: 0.5,
    },
});
