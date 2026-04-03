/**
 * CertificateShareCard — Monthly/Marathon challenge certificate.
 * Rendered off-screen, captured via ViewShot as a 1080×1920 PNG.
 * Updated to Beta V2 Theme (Formal, Cream, Purple Header, Gold Border).
 *
 * Props:
 *   userName     — participant name
 *   percentage   — score percentage (e.g. 85)
 *   totalQuestions — total monthly challenge questions
 *   correctCount — how many the user got right
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const CARD_W = 1080;
const CARD_H = 1920;

export function CertificateShareCard({ userName, percentage, totalQuestions, correctCount }) {
    const year = new Date().getFullYear();
    const isExcellence = percentage >= 60;
    const certTitle = isExcellence ? 'Certificate of Excellence' : 'Certificate of Participation';

    return (
        <View style={styles.card}>
            {/* Header Area */}
            <LinearGradient colors={['#3A1C5E', '#6B3FA0']} style={styles.header}>
                <Image
                    source={require('../assets/logo_new.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.certTitle}>{certTitle}</Text>
                <Text style={styles.certSubtitle}>Lailatul Qadr / Marathon Challenge</Text>
            </LinearGradient>

            {/* Content Area Wrap with inner gold border spacing */}
            <View style={styles.contentWrap}>
                {/* Gold Outer formal border */}
                <View style={styles.innerBorder} />

                {/* Sub-Decorations */}
                <View style={[styles.cornerDot, { top: 30, left: 30 }]} />
                <View style={[styles.cornerDot, { top: 30, right: 30 }]} />
                <View style={[styles.cornerDot, { bottom: 30, left: 30 }]} />
                <View style={[styles.cornerDot, { bottom: 30, right: 30 }]} />

                {/* ───── Awarded to ───── */}
                <Text style={styles.awardedLabel}>This certifies that</Text>
                <View style={styles.nameContainer}>
                    <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
                </View>

                <Text style={styles.desc}>
                    has successfully participated in the{'\n'}Clash of Imaan Challenge
                </Text>

                {/* ───── Stats ───── */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{percentage}%</Text>
                        <Text style={styles.statLabel}>Score Percentage</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{correctCount}/{totalQuestions}</Text>
                        <Text style={styles.statLabel}>Correct Answers</Text>
                    </View>
                </View>

                {/* ───── Arabic Dua ───── */}
                <View style={styles.duaContainer}>
                    <Text style={styles.arabic}>اللهم بارك لنا في علمنا</Text>
                    <Text style={styles.arabicEnglish}>O Allah bless us in our knowledge</Text>
                </View>

                {/* ───── Signature/Footer ───── */}
                <View style={styles.sigContainer}>
                    <View style={styles.sigLine} />
                    <Text style={styles.sigLabel}>Clash of Imaan Verified</Text>
                    <Text style={styles.yearText}>Ramadan {year}</Text>
                </View>
            </View>

            {/* Bottom Footer watermark */}
            <View style={styles.bottomFooter}>
                <Image source={require('../assets/logo_new.png')} style={styles.footerWatermark} resizeMode="contain" />
                <Text style={styles.bottomFooterText}>clashofimaan.com</Text>
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
    card: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: CREAM,
        alignItems: 'center',
    },

    /* ── Header ── */
    header: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 60,
        borderBottomWidth: 10,
        borderBottomColor: GOLD,
        zIndex: 10,
        shadowColor: PURPLE,
        elevation: 10,
    },
    logo: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: CREAM,
        borderWidth: 4,
        borderColor: GOLD,
        marginBottom: 30,
    },
    certTitle: {
        fontSize: 72,
        color: GOLD,
        fontWeight: '900',
        fontFamily: 'serif',
        textAlign: 'center',
        letterSpacing: 2,
    },
    certSubtitle: {
        fontSize: 36,
        color: CREAM,
        letterSpacing: 4,
        textTransform: 'uppercase',
        marginTop: 15,
        opacity: 0.9,
    },

    /* ── Inside Content Wrap ── */
    contentWrap: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 60,
        paddingVertical: 40,
        position: 'relative',
    },
    innerBorder: {
        position: 'absolute',
        top: 40, left: 40, right: 40, bottom: 40,
        borderWidth: 6,
        borderColor: GOLD + '60',
        borderRadius: 40,
    },
    cornerDot: {
        position: 'absolute',
        width: 24, height: 24,
        borderRadius: 12,
        backgroundColor: GOLD,
        borderWidth: 4,
        borderColor: CREAM,
    },

    /* ── Name Area ── */
    awardedLabel: {
        fontSize: 42,
        color: BROWN,
        letterSpacing: 6,
        textTransform: 'uppercase',
        fontFamily: 'serif',
        marginBottom: 50,
    },
    nameContainer: {
        borderBottomWidth: 4,
        borderBottomColor: GOLD,
        paddingHorizontal: 80,
        paddingBottom: 20,
        marginBottom: 60,
    },
    userName: {
        fontSize: 90,
        color: PURPLE,
        fontFamily: 'serif',
        fontWeight: '700',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    desc: {
        fontSize: 42,
        color: BROWN,
        lineHeight: 60,
        textAlign: 'center',
        marginBottom: 80,
        paddingHorizontal: 40,
    },

    /* ── Stats ── */
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 40,
        paddingVertical: 50,
        paddingHorizontal: 80,
        marginBottom: 80,
        width: '85%',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: GOLD + '40',
        shadowColor: BROWN,
        elevation: 8,
    },
    statBox: {
        alignItems: 'center',
    },
    statDivider: {
        width: 3,
        height: 120,
        backgroundColor: GOLD + '40',
    },
    statValue: {
        fontSize: 72,
        color: PURPLE,
        fontWeight: '900',
    },
    statLabel: {
        fontSize: 32,
        color: BROWN,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginTop: 15,
    },

    /* ── Arabic ── */
    duaContainer: {
        alignItems: 'center',
        marginBottom: 80,
    },
    arabic: {
        fontSize: 60,
        color: PURPLE,
        marginBottom: 10,
        fontFamily: 'serif',
        fontWeight: 'bold',
    },
    arabicEnglish: {
        fontSize: 36,
        color: BROWN,
        fontStyle: 'italic',
    },

    /* ── Signature ── */
    sigContainer: {
        alignItems: 'center',
    },
    sigLine: {
        width: 400,
        height: 3,
        backgroundColor: GOLD,
        marginBottom: 20,
    },
    sigLabel: {
        fontSize: 32,
        color: PURPLE,
        letterSpacing: 2,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    yearText: {
        fontSize: 28,
        color: BROWN,
        marginTop: 15,
        fontStyle: 'italic',
    },

    /* ── Footer ── */
    bottomFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 50,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 4,
        borderTopColor: GOLD + '50',
    },
    footerWatermark: {
        width: 80,
        height: 80,
        opacity: 0.9,
        marginRight: 20,
    },
    bottomFooterText: {
        fontSize: 36,
        color: BROWN,
        letterSpacing: 2,
        fontWeight: '600',
    },
});
