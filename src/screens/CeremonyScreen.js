/**
 * Ceremony Screen — Day 30 Final Celebration
 */
import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withTiming,
    Easing,
    FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AWARDS = [
    {
        title: 'Ramazan Champion',
        name: 'Ahmad ibn Khalil',
        icon: 'crown',
        color: COLORS.primaryGold,
        delay: 300,
    },
    {
        title: 'Most Consistent',
        name: 'Fatima bint Yusuf',
        icon: 'fire',
        color: '#D4763E',
        delay: 600,
    },
    {
        title: 'Fastest Responder',
        name: 'Usman al-Rashid',
        icon: 'lightning-bolt',
        color: '#5E8B4B',
        delay: 900,
    },
    {
        title: 'Most 1v1 Wins',
        name: 'Khadijah bint Ali',
        icon: 'sword-cross',
        color: '#6B6BAE',
        delay: 1200,
    },
];

function AwardCard({ award, index }) {
    return (
        <Animated.View
            entering={FadeInDown.delay(award.delay).duration(600).easing(Easing.out(Easing.cubic))}
            style={styles.awardCard}>
            <View style={[styles.awardIconContainer, { backgroundColor: award.color + '15' }]}>
                <Icon name={award.icon} size={32} color={award.color} />
            </View>
            <Text style={styles.awardTitle}>{award.title}</Text>
            <Text style={styles.awardName}>{award.name}</Text>
        </Animated.View>
    );
}

export default function CeremonyScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {/* Gold header */}
                <Animated.View
                    entering={FadeInDown.duration(800)}
                    style={styles.header}>
                    <Icon name="star-crescent" size={48} color={COLORS.primaryGold} />
                    <Text style={styles.mainTitle}>Ramazan Mubarak</Text>
                    <Text style={styles.subtitle}>
                        The blessed month has come to an end
                    </Text>
                    <View style={styles.decorLine} />
                </Animated.View>

                <Animated.Text
                    entering={FadeInDown.delay(200).duration(600)}
                    style={styles.awardsTitle}>
                    Awards
                </Animated.Text>

                {/* Award Cards */}
                <View style={styles.awardsGrid}>
                    {AWARDS.map((award, index) => (
                        <AwardCard key={index} award={award} index={index} />
                    ))}
                </View>

                {/* Closing message */}
                <Animated.View
                    entering={FadeInDown.delay(1500).duration(600)}
                    style={styles.closingContainer}>
                    <Text style={styles.closingText}>
                        May Allah accept all our prayers, fasting, and good deeds. See you
                        next Ramazan, InshaAllah.
                    </Text>
                </Animated.View>

                {/* Close button */}
                <Animated.View entering={FadeInDown.delay(1800).duration(400)}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => navigation.goBack()}>
                        <Text style={styles.closeButtonText}>Return Home</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.xxl,
        paddingTop: SPACING.xxl + 40,
        paddingBottom: 60,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    mainTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.display + 4,
        color: COLORS.primaryGold,
        marginTop: SPACING.lg,
        letterSpacing: 1,
        textAlign: 'center',
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
    decorLine: {
        width: 60,
        height: 2,
        backgroundColor: COLORS.primaryGold,
        marginTop: SPACING.lg,
        opacity: 0.5,
    },
    awardsTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xxl,
        color: COLORS.darkBrown,
        marginBottom: SPACING.xl,
        letterSpacing: 1,
        alignSelf: 'flex-start',
    },
    awardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.lg,
        justifyContent: 'center',
        marginBottom: SPACING.xxl,
    },
    awardCard: {
        width: (SCREEN_WIDTH - 80) / 2,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        alignItems: 'center',
        ...SHADOWS.elevated,
    },
    awardIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    awardTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.darkBrown,
        textAlign: 'center',
        marginBottom: SPACING.xs,
        letterSpacing: 0.5,
    },
    awardName: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        textAlign: 'center',
    },
    closingContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xxl,
        marginBottom: SPACING.xxl,
        ...SHADOWS.card,
    },
    closingText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        textAlign: 'center',
        lineHeight: 22,
        fontStyle: 'italic',
    },
    closeButton: {
        paddingHorizontal: SPACING.xxl + 16,
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.pill,
        backgroundColor: COLORS.primaryGold,
        ...SHADOWS.card,
    },
    closeButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.cardBackground,
        letterSpacing: 1,
    },
});
