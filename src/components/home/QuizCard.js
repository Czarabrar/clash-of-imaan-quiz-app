import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme';

export default function QuizCard({ quiz, onAnswer, userResponse, isAdmin }) {
    const [selectedIndex, setSelectedIndex] = useState(
        userResponse ? userResponse.selectedIndex : null,
    );

    useEffect(() => {
        setSelectedIndex(userResponse?.selectedIndex !== undefined ? userResponse.selectedIndex : null);
    }, [userResponse, quiz?.id]);

    const isCompleted = userResponse?.selectedIndex !== undefined;
    const isLocked = quiz?.status === 'locked';

    const handleSelect = (index) => {
        if (isCompleted || isLocked || isAdmin) return;
        setSelectedIndex(index);
        if (onAnswer) {
            onAnswer(index);
        }
    };

    if (!quiz) return null;

    if (isLocked) {
        return (
            <View style={[styles.card, styles.lockedCard]}>
                <View style={styles.lockedContent}>
                    <Icon name="lock" size={48} color={COLORS.lightBrown} style={styles.lockIcon} />
                    <Text style={styles.lockedTitle}>Quiz Locked</Text>
                    <Text style={styles.lockedSubtitle}>
                        Unlocks in {quiz.hoursLeft || '?'} hours
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            {/* Gold progress bar */}
            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressFill,
                        { width: isCompleted ? '100%' : '0%' },
                    ]}
                />
            </View>

            <View style={styles.content}>
                <Text style={styles.questionNumber}>
                    Q.{String(quiz.dayNumber || 1).padStart(2, '0')}
                </Text>

                <Text style={styles.questionText}>{quiz.question}</Text>

                {/* Admin notice banner */}
                {isAdmin ? (
                    <View style={styles.adminNoticeBanner}>
                        <Icon name="shield-account" size={14} color={COLORS.primaryGold} />
                        <Text style={styles.adminNoticeText}>
                            Admin cannot participate in daily quiz.
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.selectHint}>Select only 1</Text>
                )}

                <View style={styles.optionsContainer}>
                    {(quiz.options || []).map((option, index) => {
                        const isSelected = selectedIndex === index;
                        // Only show correct/wrong coloring if admin has revealed results
                        const resultsRevealed = !!quiz.resultsRevealed;
                        const isCorrect =
                            isCompleted && resultsRevealed && index === quiz.correctIndex;
                        const isWrong =
                            isCompleted && resultsRevealed && isSelected && index !== quiz.correctIndex;

                        return (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.option,
                                    isAdmin && styles.optionAdminDisabled,
                                    isSelected && !isAdmin && styles.optionSelected,
                                    isCorrect && isCompleted && styles.optionCorrect,
                                    isWrong && styles.optionWrong,
                                ]}
                                onPress={() => handleSelect(index)}
                                disabled={isCompleted || selectedIndex !== null || isAdmin}
                                activeOpacity={isAdmin ? 1 : 0.7}>
                                <View
                                    style={[
                                        styles.radio,
                                        isSelected && !isAdmin && styles.radioSelected,
                                        isCorrect && isCompleted && styles.radioCorrect,
                                        isAdmin && styles.radioAdminDisabled,
                                    ]}>
                                    {isSelected && !isAdmin && <View style={styles.radioInner} />}
                                </View>
                                <Text
                                    style={[
                                        styles.optionText,
                                        isAdmin && styles.optionTextAdminDisabled,
                                        isSelected && !isAdmin && styles.optionTextSelected,
                                    ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {isCompleted && !isAdmin && (
                    <View style={styles.resultContainer}>
                        <Text style={styles.resultText}>
                            Answer submitted ✔ View today's leaderboard
                        </Text>
                    </View>
                )}
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
        backgroundColor: COLORS.primaryGold,
        borderRadius: 2,
    },
    content: {
        padding: SPACING.xl,
    },
    questionNumber: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.primaryGold,
        marginBottom: SPACING.sm,
        letterSpacing: 2,
    },
    questionText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xl,
        color: COLORS.darkBrown,
        lineHeight: 26,
        marginBottom: SPACING.sm,
    },
    selectHint: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        color: COLORS.lightBrown,
        marginBottom: SPACING.lg,
        letterSpacing: 0.5,
    },
    adminNoticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.primaryGold + '15',
        borderRadius: BORDER_RADIUS.sm,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.lg,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primaryGold,
    },
    adminNoticeText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        color: COLORS.primaryGold,
        letterSpacing: 0.3,
        flex: 1,
    },
    optionsContainer: {
        gap: SPACING.md,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.beigeDark,
        backgroundColor: COLORS.cardBackground,
    },
    optionAdminDisabled: {
        backgroundColor: COLORS.background,
        borderColor: COLORS.beigeDark,
        opacity: 0.6,
    },
    optionSelected: {
        borderColor: COLORS.primaryGold,
        backgroundColor: '#FBF5E6',
    },
    optionCorrect: {
        borderColor: COLORS.success,
        backgroundColor: '#F0F5EC',
    },
    optionWrong: {
        borderColor: COLORS.error,
        backgroundColor: '#F5ECEC',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.darkBrown,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    radioSelected: {
        borderColor: COLORS.primaryGold,
    },
    radioCorrect: {
        borderColor: COLORS.success,
    },
    radioAdminDisabled: {
        borderColor: COLORS.beigeDark,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primaryGold,
    },
    optionText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        flex: 1,
    },
    optionTextSelected: {
        color: COLORS.darkBrown,
        fontWeight: '600',
    },
    optionTextAdminDisabled: {
        color: COLORS.lightBrown,
    },
    resultContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.lg,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.beigeDark,
    },
    resultText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.primaryGold,
    },
    rankText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
    },
    lockedCard: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAF5EE',
        paddingVertical: 40,
    },
    lockedContent: {
        padding: SPACING.xxxl,
        alignItems: 'center',
    },
    lockIcon: {
        marginBottom: SPACING.md,
        opacity: 0.8,
    },
    lockedTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
        marginBottom: SPACING.xs,
    },
    lockedSubtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
    },
});
