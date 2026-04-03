import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import QuizCard from './QuizCard';
import QuizCardLocked from './QuizCardLocked';
import PaginationDots from './PaginationDots';
import { COLORS, SPACING, TYPOGRAPHY, FONT_SIZES } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function QuizCarousel({ quizzes = [], userResponses = {}, onAnswer, onViewLeaderboard, isAdmin }) {
    const [activeIndex, setActiveIndex] = useState(0);

    // Sort: today first, then older descending
    const sortedQuizzes = [...quizzes].sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return (b.dayNumber || 0) - (a.dayNumber || 0);
    });

    const renderItem = useCallback(
        ({ item, index }) => {
            const isOlder = index > 0 && item.status === 'completed';
            const response = userResponses[item.id];
            const isLocked = item.status === 'locked';

            if (isLocked) {
                return (
                    <View
                        style={[
                            styles.cardContainer,
                            isOlder && styles.olderCard,
                        ]}>
                        <QuizCardLocked quiz={item} />
                    </View>
                );
            }

            if (isOlder && response) {
                return (
                    <TouchableOpacity
                        style={[styles.cardContainer, styles.olderCard]}
                        onPress={() => onViewLeaderboard && onViewLeaderboard(item.id)}
                        activeOpacity={0.8}>
                        <QuizCard quiz={item} userResponse={response} isAdmin={isAdmin} />
                        <View style={styles.tapHint}>
                            <Text style={styles.tapHintText}>Tap to view leaderboard</Text>
                        </View>
                    </TouchableOpacity>
                );
            }

            return (
                <View style={styles.cardContainer}>
                    <QuizCard
                        quiz={item}
                        userResponse={response}
                        isAdmin={isAdmin}
                        onAnswer={(selectedIndex) => onAnswer && onAnswer(item.id, selectedIndex)}
                    />
                </View>
            );
        },
        [userResponses, onAnswer, onViewLeaderboard, isAdmin],
    );

    if (sortedQuizzes.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No quizzes available yet</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Carousel
                data={sortedQuizzes}
                renderItem={renderItem}
                width={SCREEN_WIDTH - 40}
                height={400}
                mode="stack"
                modeConfig={{
                    snapDirection: 'left',
                    stackInterval: 18,
                }}
                loop={false}
                autoPlay={false}
                scrollAnimationDuration={400}
                onSnapToItem={(index) => setActiveIndex(index)}
                style={styles.carousel}
            />
            <PaginationDots total={sortedQuizzes.length} activeIndex={activeIndex} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: SPACING.lg,
    },
    carousel: {
        alignSelf: 'center',
    },
    cardContainer: {
        width: '100%',
        height: 390,
    },
    olderCard: {
        opacity: 0.6,
        transform: [{ scale: 0.97 }],
    },
    tapHint: {
        position: 'absolute',
        bottom: 10,
        right: 15,
    },
    tapHintText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.xs,
        color: COLORS.lightBrown,
        fontStyle: 'italic',
    },
    emptyContainer: {
        padding: SPACING.xxl,
        alignItems: 'center',
    },
    emptyText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
    },
});
