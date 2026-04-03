import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Line, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { COLORS } from '../../theme';

const AnimatedView = Animated.createAnimatedComponent(View);
const SCREEN_WIDTH = Dimensions.get('window').width;

function Lantern({ x, delay, size = 40 }) {
    const sway = useSharedValue(0);

    useEffect(() => {
        sway.value = withRepeat(
            withTiming(1, { duration: 3000 + delay, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
    }, [sway, delay]);

    const animatedStyle = useAnimatedStyle(() => {
        const rotate = interpolate(sway.value, [0, 1], [-2, 2]);
        return {
            transform: [{ rotate: `${rotate}deg` }],
            transformOrigin: 'top center',
        };
    });

    return (
        <AnimatedView style={[{ position: 'absolute', left: x, top: 0 }, animatedStyle]}>
            <Svg width={size} height={size * 2.5} viewBox="0 0 40 100">
                <Defs>
                    <RadialGradient id="glow" cx="20" cy="55" r="18">
                        <Stop offset="0" stopColor={COLORS.primaryGold} stopOpacity="0.4" />
                        <Stop offset="1" stopColor={COLORS.primaryGold} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* Hanging line */}
                <Line
                    x1="20" y1="0"
                    x2="20" y2="30"
                    stroke={COLORS.primaryGold}
                    strokeWidth="0.8"
                    opacity={0.6}
                />

                {/* Top cap */}
                <Path
                    d="M16 30 L24 30 L22 34 L18 34 Z"
                    fill={COLORS.primaryGold}
                    opacity={0.7}
                />

                {/* Lantern body */}
                <Path
                    d="M14 34 Q14 50 20 58 Q26 50 26 34"
                    stroke={COLORS.primaryGold}
                    strokeWidth="1.2"
                    fill="none"
                    opacity={0.7}
                />

                {/* Decorative bands */}
                <Line x1="15" y1="40" x2="25" y2="40" stroke={COLORS.primaryGold} strokeWidth="0.5" opacity={0.5} />
                <Line x1="14.5" y1="46" x2="25.5" y2="46" stroke={COLORS.primaryGold} strokeWidth="0.5" opacity={0.5} />

                {/* Inner glow */}
                <Circle cx="20" cy="45" r="8" fill="url(#glow)" />

                {/* Bottom point */}
                <Path
                    d="M18 58 L20 64 L22 58"
                    stroke={COLORS.primaryGold}
                    strokeWidth="0.8"
                    fill="none"
                    opacity={0.6}
                />
            </Svg>
        </AnimatedView>
    );
}

export default function HangingLanterns() {
    return (
        <View style={styles.container}>
            <Lantern x={SCREEN_WIDTH - 75} delay={0} size={35} />
            <Lantern x={SCREEN_WIDTH - 40} delay={500} size={28} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 120,
        zIndex: 2,
    },
});
