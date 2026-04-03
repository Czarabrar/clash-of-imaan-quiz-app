/**
 * ResultShareCard — 1:1 square share image (captured at 1080×1080)
 * Designed for both winning and losing quiz results using Beta V2 Theme.
 *
 * Props: userName, score, total, isWin, timeSeconds
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Card is square — fixed 1080x1080 ratio for high quality sharing
const CARD_SIZE = 1080;

export function ResultShareCard({ userName, opponentName, score, total, isWin, timeSeconds }) {
    return (
        <View style={styles.card} collapsable={false}>
            {/* ── Background Pattern/Decorations ── */}
            <View style={styles.bgDecorations} pointerEvents="none">
                <Icon name="mosque" size={320} color={GOLD} style={styles.bgMosque} />
                <Icon name="star-four-points-outline" size={60} color={GOLD} style={styles.bgStar1} />
                <Icon name="star-four-points-outline" size={40} color={GOLD} style={styles.bgStar2} />
            </View>

            {/* ── Header Area ── */}
            <LinearGradient colors={['#3A1C5E', '#6B3FA0']} style={styles.header}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../assets/logo_new.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.subtitle}>Clash of Imaan Challenge</Text>
            </LinearGradient>

            {/* ── Content ── */}
            <View style={styles.content}>
                {/* Main Title */}
                <Text style={styles.titleLine1}>{isWin ? 'MashaAllah! You won' : 'SubhanAllah'}</Text>

                {/* Match Result Banner */}
                <View style={[styles.resultBanner, { borderColor: isWin ? GOLD : PURPLE }]}>
                    <Icon name={isWin ? 'crown' : 'close'} size={48} color={isWin ? GOLD : PURPLE} />
                    <Text style={styles.titleLine2}>{isWin ? 'Victory!' : 'Match Final'} {isWin ? '🏆' : '🤍'}</Text>
                </View>

                {/* Player Name */}
                <View style={styles.namesRow}>
                    <Text style={styles.winnerText}>{userName}</Text>
                    {opponentName && (
                        <Text style={styles.opponentText}>    vs    {opponentName}</Text>
                    )}
                </View>

                {/* Score Area */}
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreLabel}>Score</Text>
                    <Text style={styles.scoreText}>
                        {score} / {total}
                    </Text>
                    {timeSeconds !== undefined && (
                        <>
                            <View style={styles.scoreDivider} />
                            <Text style={styles.scoreLabel}>Time taken</Text>
                            <Text style={styles.timeText}>
                                {timeSeconds} seconds
                            </Text>
                        </>
                    )}
                </View>

                {/* Victory/Loss message */}
                <Text style={styles.messageText}>
                    {isWin
                        ? `MashaAllah! You won. May Allah bless you with more knowledge.`
                        : `SubhanAllah, you lost. Keep trying — may Allah provide you the right ilm.`}
                </Text>

                {/* Gold Separator */}
                <View style={styles.goldSeparator} />

                {/* Arabic Dua */}
                <Text style={styles.arabicDua}>{isWin ? 'رَبِّ زِدْنِي عِلْمًا' : 'اللَّهُمَّ زِدْنِي عِلْمًا'}</Text>
                <Text style={styles.arabicTranslation}>{isWin ? 'My Lord, increase me in knowledge.' : 'O Allah, increase me in knowledge.'}</Text>
            </View>

            {/* ── Footer ── */}
            <View style={styles.footer}>
                <Image source={require('../assets/logo_new.png')} style={styles.footerLogo} resizeMode="contain" />
                <Text style={styles.footerText}>clashofimaan.com</Text>
            </View>
        </View>
    );
}

/* ──────────── Beta V2 Theme Colors ──────────── */
const CREAM = '#F6F1E8';
const PURPLE = '#3A1C5E';
const BROWN = '#7A6E5D';
const GOLD = '#C8A951';

/* ──────────── Styles ──────────── */
const styles = StyleSheet.create({
    /* ── Card container (square) ── */
    card: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        backgroundColor: CREAM,
        alignItems: 'center',
    },

    /* ── Islamic Template Decors ── */
    bgDecorations: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.08,
    },
    bgMosque: { position: 'absolute', bottom: -50, right: -80 },
    bgStar1: { position: 'absolute', top: 380, left: 80 },
    bgStar2: { position: 'absolute', top: 500, right: 120 },

    /* ── Header ── */
    header: {
        width: '100%',
        paddingVertical: 50,
        alignItems: 'center',
        borderBottomWidth: 4,
        borderBottomColor: GOLD,
    },
    logoContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: CREAM,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        ...StyleSheet.absoluteFillObject,
        shadowColor: '#000',
        elevation: 10,
        alignSelf: 'center',
        position: 'static',
    },
    logo: {
        width: 120,
        height: 120,
    },
    subtitle: {
        color: CREAM,
        fontSize: 36,
        fontFamily: 'serif',
        fontWeight: '600',
        letterSpacing: 2,
    },

    /* ── Content ── */
    content: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 40,
        width: '100%',
    },

    /* ── Typography ── */
    titleLine1: {
        fontSize: 64,
        color: PURPLE,
        fontWeight: '900',
        fontFamily: 'serif',
        marginBottom: 20,
    },
    resultBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderWidth: 2,
        borderRadius: 40,
        backgroundColor: '#FFFFFF80',
        marginBottom: 30,
        gap: 20,
    },
    titleLine2: {
        fontSize: 54,
        color: BROWN,
        fontWeight: '700',
        fontFamily: 'serif',
    },

    /* ── Names ── */
    namesRow: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    winnerText: {
        color: PURPLE,
        fontSize: 52,
        fontWeight: '800',
        fontStyle: 'italic',
    },
    opponentText: {
        color: BROWN,
        fontSize: 36,
        fontWeight: '600',
        marginTop: 5,
    },

    /* ── Score Container ── */
    scoreContainer: {
        backgroundColor: '#FFFFFF90',
        borderWidth: 2,
        borderColor: GOLD + '50',
        borderRadius: 30,
        paddingVertical: 30,
        paddingHorizontal: 80,
        alignItems: 'center',
        marginBottom: 40,
        width: '80%',
    },
    scoreDivider: {
        height: 2,
        width: '50%',
        backgroundColor: GOLD + '50',
        marginVertical: 20,
    },
    scoreLabel: {
        color: BROWN,
        fontSize: 32,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '600',
        marginBottom: 10,
    },
    scoreText: {
        color: GOLD,
        fontSize: 64,
        fontWeight: '900',
    },
    timeText: {
        color: PURPLE,
        fontSize: 48,
        fontWeight: '700',
    },

    /* ── Message ── */
    messageText: {
        color: BROWN,
        fontSize: 42,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 60,
        marginBottom: 30,
    },

    /* ── Dua section ── */
    goldSeparator: {
        height: 2,
        width: '30%',
        backgroundColor: GOLD,
        marginBottom: 30,
    },
    arabicDua: {
        fontSize: 60,
        color: PURPLE,
        fontWeight: '700',
        marginBottom: 10,
    },
    arabicTranslation: {
        color: BROWN,
        fontSize: 36,
        fontStyle: 'italic',
        textAlign: 'center',
    },

    /* ── Footer ── */
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
        paddingTop: 20,
        gap: 15,
        width: '100%',
        borderTopWidth: 2,
        borderTopColor: GOLD + '30',
        backgroundColor: CREAM,
    },
    footerLogo: {
        width: 60,
        height: 60,
    },
    footerText: {
        color: BROWN,
        fontSize: 32,
        fontWeight: '600',
        letterSpacing: 1,
    },
});
