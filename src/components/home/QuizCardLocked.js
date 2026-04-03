import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'react-native/Libraries/Components/UnimplementedViews/UnimplementedView';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme';

export default function QuizCardLocked({ quiz }) {
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const updateCountdown = () => {
            if (!quiz?.unlockTime) {
                setCountdown('Coming soon');
                return;
            }
            const unlockDate = quiz.unlockTime.toDate
                ? quiz.unlockTime.toDate()
                : new Date(quiz.unlockTime);
            const now = new Date();
            const diff = unlockDate - now;

            if (diff <= 0) {
                setCountdown('Unlocking...');
                return;
            }

            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setCountdown(
                `${hours.toString().padStart(2, '0')}:${minutes
                    .toString()
                    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            );
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [quiz]);

    const unlockTimeStr = quiz?.unlockTime
        ? (() => {
            const d = quiz.unlockTime.toDate
                ? quiz.unlockTime.toDate()
                : new Date(quiz.unlockTime);
            let h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, '0');
            const ap = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ap}`;
        })()
        : '4:45 AM';

    return (
        <View style={styles.card}>
            <View style={styles.progressBar}>
                <View style={styles.progressFill} />
            </View>

            <View style={styles.content}>
                <Text style={styles.questionNumber}>
                    Q.{String(quiz?.dayNumber || '?').padStart(2, '0')}
                </Text>

                {/* Blurred placeholder lines */}
                <View style={styles.blurredLines}>
                    <View style={[styles.blurLine, { width: '90%' }]} />
                    <View style={[styles.blurLine, { width: '75%' }]} />
                    <View style={[styles.blurLine, { width: '60%' }]} />
                </View>

                {/* Overlay */}
                <View style={styles.overlay}>
                    <View style={styles.lockIcon}>
                        <Text style={styles.lockEmoji}>🔒</Text>
                    </View>
                    <Text style={styles.unlocksAt}>Unlocks at {unlockTimeStr}</Text>
                    <Text style={styles.countdown}>{countdown}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...SHADOWS.card,
    },
    progressBar: {
        height: 3,
        backgroundColor: COLORS.beigeDark,
        width: '100%',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.lightBrown,
        width: '0%',
        borderRadius: 2,
    },
    content: {
        padding: SPACING.xl,
        minHeight: 230,
        justifyContent: 'center',
    },
    questionNumber: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginBottom: SPACING.lg,
        letterSpacing: 2,
        opacity: 0.5,
    },
    blurredLines: {
        gap: SPACING.md,
        opacity: 0.3,
    },
    blurLine: {
        height: 14,
        backgroundColor: COLORS.lightBrown,
        borderRadius: 4,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(251, 248, 243, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.lg,
    },
    lockIcon: {
        marginBottom: SPACING.md,
    },
    lockEmoji: {
        fontSize: 28,
    },
    unlocksAt: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
        marginBottom: SPACING.sm,
    },
    countdown: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xxl,
        color: COLORS.primaryGold,
        letterSpacing: 2,
    },
});
