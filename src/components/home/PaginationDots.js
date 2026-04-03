import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../theme';

export default function PaginationDots({ total, activeIndex }) {
    return (
        <View style={styles.container}>
            {Array.from({ length: total }).map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        index === activeIndex ? styles.activeDot : styles.inactiveDot,
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
    },
    dot: {
        borderRadius: 4,
    },
    activeDot: {
        width: 10,
        height: 10,
        backgroundColor: COLORS.primaryGold,
    },
    inactiveDot: {
        width: 7,
        height: 7,
        backgroundColor: COLORS.lightBrown,
        opacity: 0.5,
    },
});
