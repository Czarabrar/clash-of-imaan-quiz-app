import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MosqueArtwork from './MosqueArtwork';
import HangingLanterns from './HangingLanterns';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY } from '../../theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HeroSection({ dayNumber = 1, isAdmin = false }) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return { time: `${hours.toString().padStart(2, '0')}:${minutes}`, ampm };
    };

    const { time, ampm } = formatTime(currentTime);

    return (
        <View style={[styles.container, isAdmin && { height: SCREEN_HEIGHT * 0.25 }]}>
            <HangingLanterns />

            <View style={styles.artworkContainer}>
                <MosqueArtwork scale={isAdmin ? 0.5 : 1} />

                {/* Time overlay on top of artwork */}
                <View style={[styles.timeOverlay, isAdmin && { top: '35%' }]}>
                    <Text style={[styles.timeText, isAdmin && { fontSize: FONT_SIZES.clock * 0.5 }]}>{time}</Text>
                    <Text style={[styles.ampmText, isAdmin && { fontSize: FONT_SIZES.md * 0.5, marginTop: -2 }]}>{ampm}</Text>
                </View>
            </View>

            <Text style={styles.sehriText}>Sehri Time</Text>
            <Text style={styles.dayText}>Day {dayNumber} of Ramazan</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: SCREEN_HEIGHT * 0.35,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: SPACING.xl,
    },
    artworkContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    timeOverlay: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        top: '38%',
    },
    timeText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.clock,
        color: COLORS.primaryGold,
        letterSpacing: 2,
    },
    ampmText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.md,
        color: COLORS.primaryGold,
        marginTop: -4,
        letterSpacing: 1,
    },
    sehriText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
        marginTop: SPACING.sm,
        letterSpacing: 1,
    },
    dayText: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginTop: SPACING.xs,
        letterSpacing: 0.5,
    },
});
