/**
 * LeaderboardShareCard — 9:16 vertical share image (captured at 1080×1920)
 * Beta V2 Theme Alignment.
 *
 * Props:
 *   topThree   {Array<{name}>}   — first 3 winners
 *   remaining  {Array<{name}>}   — 4th place onward (up to 50)
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// 9:16 high-res ratio — keep width 1080, increase height to fit long leaderboards
const CARD_W = 1080;
const CARD_H = 3000;

export function LeaderboardShareCard({ topThree = [], remaining = [], variant = 'overall' }) {
    const first = topThree[0]?.name || '—';
    const second = topThree[1]?.name || '—';
    const third = topThree[2]?.name || '—';

    // Split remaining into two columns
    const half = Math.ceil(remaining.length / 2);
    const col1 = remaining.slice(0, half);
    const col2 = remaining.slice(half);

    const variantLabel = variant === 'daily' ? 'Daily Leaderboard' : 'Overall Leaderboard';

    return (
        <View style={styles.card} collapsable={false}>
            {/* ═══════ HEADER ═══════ */}
            <LinearGradient colors={['#3A1C5E', '#6B3FA0']} style={styles.header}>
                <View style={styles.logoWrap}>
                    <Image
                        source={require('../assets/logo_new.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <Text style={styles.headerSub}>{variantLabel} · JazakAllah to everyone who participated</Text>
            </LinearGradient>

            {/* ═══════ DECORATIVE ELEMENTS ═══════ */}
            <View style={[styles.cornerDot, { top: CARD_H * 0.18, left: 20 }]} />
            <View style={[styles.cornerDot, { top: CARD_H * 0.18, right: 20 }]} />
            <View style={[styles.cornerDot, { bottom: 20, left: 20 }]} />
            <View style={[styles.cornerDot, { bottom: 20, right: 20 }]} />

            {/* ═══════ FLAT PODIUM ═══════ */}
            <View style={styles.podiumContainer}>
                {/* 1st Place */}
                <View style={[styles.podiumRow, styles.podiumFirst]}>
                    <Text style={styles.rankFirst}>1</Text>
                    <View style={styles.medalWrap}>
                        <Text style={styles.podiumCrown}>👑</Text>
                        <Text style={styles.podiumMedal}>🥇</Text>
                    </View>
                    <Text style={[styles.podiumName, styles.podiumNameFirst]} numberOfLines={1}>{first}</Text>
                </View>

                {/* 2nd Place */}
                <View style={styles.podiumRow}>
                    <Text style={styles.rankNumber}>2</Text>
                    <Text style={styles.podiumMedal}>🥈</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>{second}</Text>
                </View>

                {/* 3rd Place */}
                <View style={styles.podiumRow}>
                    <Text style={styles.rankNumber}>3</Text>
                    <Text style={styles.podiumMedal}>🥉</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>{third}</Text>
                </View>
            </View>

            <View style={styles.goldSeparator} />

            {/* ═══════ RANKING TABLE ═══════ */}
            {remaining.length > 0 && (
                <View style={styles.tableContainer}>
                    <View style={styles.tableInner}>
                        {/* Left column */}
                        <View style={styles.tableCol}>
                            {col1.map((user, i) => (
                                <View key={`l-${i}`} style={styles.tableRow}>
                                    <Text style={styles.tableRank}>{i + 4}</Text>
                                    <View style={styles.tableDash} />
                                    <Text style={styles.tableName} numberOfLines={1}>{user.name}</Text>
                                </View>
                            ))}
                        </View>
                        {/* Right column */}
                        <View style={styles.tableCol}>
                            {col2.map((user, i) => (
                                <View key={`r-${i}`} style={styles.tableRow}>
                                    <Text style={styles.tableRank}>{half + i + 4}</Text>
                                    <View style={styles.tableDash} />
                                    <Text style={styles.tableName} numberOfLines={1}>{user.name}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            )}

            {/* ═══════ DUA FOOTER ═══════ */}
            <View style={styles.duaSection}>
                <Text style={styles.duaArabic}>اللَّهُمَّ بَارِكْ لَنَا فِي عِلْمِنَا</Text>
                <Text style={styles.duaEnglish}>O Allah bless us in our knowledge.</Text>
            </View>

            {/* ═══════ BOTTOM FOOTER ═══════ */}
            <View style={styles.footer}>
                <Image source={require('../assets/logo_new.png')} style={styles.footerWatermark} resizeMode="contain" />
                <View style={styles.footerFlex}>
                    <Text style={styles.footerEmoji}>🌙</Text>
                    <Text style={styles.footerMsg}>
                        Rank: #Top{remaining.length + 3} {'\n'}Clash of Imaan Leaderboard
                    </Text>
                    <Text style={styles.footerEmoji}>🌙</Text>
                </View>
            </View>
        </View>
    );
}

/* ──────────── Beta V2 Theme Colors ──────────── */
const CREAM = '#F6F1E8';
const PURPLE = '#3A1C5E';
const BROWN = '#7A6E5D';
const GOLD = '#C8A951';
const WHITE = '#FFFFFF';

/* ──────────── Styles ──────────── */
const styles = StyleSheet.create({
    /* ── Card ── */
    card: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: CREAM,
        alignItems: 'center',
        overflow: 'hidden',
    },

    cornerDot: {
        position: 'absolute',
        width: 16, height: 16,
        borderRadius: 8,
        backgroundColor: GOLD,
        opacity: 0.5,
    },

    /* ═══ HEADER ═══ */
    header: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 40,
        borderBottomWidth: 5,
        borderBottomColor: GOLD,
        shadowColor: PURPLE,
        elevation: 10,
    },
    logoWrap: {
        width: 180, height: 180,
        borderRadius: 90,
        backgroundColor: CREAM,
        borderWidth: 4, borderColor: GOLD,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        marginBottom: 30,
    },
    logo: {
        width: 140, height: 140,
        borderRadius: 70,
    },
    headerTitle: {
        color: GOLD,
        fontSize: 72,
        fontWeight: '900', fontStyle: 'italic',
        fontFamily: 'serif',
        letterSpacing: 2,
        marginBottom: 10,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
    },
    headerSub: {
        color: WHITE,
        fontSize: 34,
        fontStyle: 'italic', opacity: 0.9,
    },

    /* ═══ FLAT PODIUM ═══ */
    podiumContainer: {
        width: CARD_W * 0.85,
        marginTop: 60,
        backgroundColor: '#FFFFFF60',
        borderRadius: 30,
        paddingHorizontal: 40,
        paddingVertical: 30,
        gap: 20,
    },
    podiumRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: GOLD + '40',
        shadowColor: BROWN,
        elevation: 5,
        opacity: 0.95,
    },
    podiumFirst: {
        borderColor: GOLD,
        borderWidth: 4,
        paddingVertical: 36,
        transform: [{ scale: 1.05 }],
        zIndex: 10,
        backgroundColor: '#FFFBF2',
    },
    rankNumber: {
        fontSize: 48,
        color: PURPLE,
        fontWeight: '900',
        width: 80,
        textAlign: 'center',
    },
    rankFirst: {
        fontSize: 72,
        color: GOLD,
        fontWeight: '900',
        width: 80,
        textAlign: 'center',
    },
    medalWrap: {
        alignItems: 'center',
        marginHorizontal: 16,
    },
    podiumCrown: {
        fontSize: 36,
        marginBottom: -10,
    },
    podiumMedal: {
        fontSize: 48,
        marginHorizontal: 16,
    },
    podiumName: {
        color: PURPLE,
        fontSize: 42,
        fontWeight: '700',
        flex: 1,
        marginLeft: 20,
    },
    podiumNameFirst: {
        color: PURPLE,
        fontSize: 54,
        fontWeight: '900',
    },

    goldSeparator: {
        height: 3,
        width: '50%',
        backgroundColor: GOLD + '60',
        marginVertical: 40,
    },

    /* ═══ TABLE ═══ */
    tableContainer: {
        width: CARD_W * 0.90,
        backgroundColor: '#FFFFFF80',
        borderRadius: 20,
        borderWidth: 2, borderColor: GOLD + '30',
        paddingVertical: 30, paddingHorizontal: 40,
    },
    tableInner: {
        flexDirection: 'row',
        gap: 40,
    },
    tableCol: {
        flex: 1,
        gap: 16,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: GOLD + '20',
    },
    tableRank: {
        color: GOLD, fontSize: 32,
        fontWeight: '800', width: 60,
        textAlign: 'right',
    },
    tableDash: {
        width: 8,
        height: 3,
        backgroundColor: BROWN + '40',
        marginHorizontal: 20,
    },
    tableName: {
        color: BROWN, fontSize: 32,
        fontWeight: '600', flex: 1,
    },

    /* ═══ DUA ═══ */
    duaSection: {
        alignItems: 'center',
        marginTop: 60,
    },
    duaArabic: {
        fontSize: 64,
        fontFamily: 'serif',
        color: PURPLE, fontWeight: '700',
        letterSpacing: 2, textAlign: 'center',
    },
    duaEnglish: {
        color: BROWN, fontSize: 32,
        fontStyle: 'italic',
        marginTop: 10, textAlign: 'center',
    },

    /* ═══ FOOTER ═══ */
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0, right: 0,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 4,
        borderTopColor: GOLD,
        paddingBottom: 40,
        paddingTop: 30,
    },
    footerWatermark: {
        width: 60, height: 60,
        marginBottom: 20,
        opacity: 0.8,
    },
    footerFlex: {
        flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 40, gap: 16,
    },
    footerEmoji: {
        fontSize: 48,
    },
    footerMsg: {
        color: PURPLE, fontSize: 36,
        fontWeight: '700', textAlign: 'center',
        lineHeight: 50,
    },
});
