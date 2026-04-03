import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { COLORS } from '../../theme';

const DEFAULT_SIZE = Dimensions.get('window').width * 0.55;

export default function MosqueArtwork({ scale = 1 }) {
    const SIZE = DEFAULT_SIZE * scale;

    return (
        <View style={styles.container}>
            <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
                <Defs>
                    <RadialGradient id="bgGlow" cx="100" cy="100" r="100">
                        <Stop offset="0" stopColor={COLORS.primaryGold} stopOpacity="0.15" />
                        <Stop offset="0.7" stopColor={COLORS.primaryGold} stopOpacity="0.05" />
                        <Stop offset="1" stopColor={COLORS.primaryGold} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* Outer glow circle */}
                <Circle cx="100" cy="100" r="98" fill="url(#bgGlow)" />

                {/* Outer ring */}
                <Circle
                    cx="100" cy="100" r="92"
                    stroke={COLORS.primaryGold}
                    strokeWidth="1.5"
                    fill="none"
                />

                {/* Inner ring */}
                <Circle
                    cx="100" cy="100" r="85"
                    stroke={COLORS.primaryGold}
                    strokeWidth="0.5"
                    fill="none"
                    strokeDasharray="4,4"
                />

                {/* Geometric star pattern */}
                <G opacity={0.3}>
                    <Path
                        d="M100 15 L115 80 L180 100 L115 120 L100 185 L85 120 L20 100 L85 80 Z"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                    <Path
                        d="M55 30 L130 70 L170 55 L130 130 L145 170 L70 130 L30 145 L70 70 Z"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.3"
                        fill="none"
                    />
                </G>

                {/* Mosque silhouette */}
                <G>
                    {/* Central dome */}
                    <Path
                        d="M70 130 Q75 100 100 85 Q125 100 130 130"
                        fill={COLORS.primaryGold}
                        opacity={0.25}
                    />
                    <Path
                        d="M70 130 Q75 100 100 85 Q125 100 130 130"
                        stroke={COLORS.primaryGold}
                        strokeWidth="1.5"
                        fill="none"
                    />

                    {/* Central minaret */}
                    <Path
                        d="M97 85 L97 65 L100 58 L103 65 L103 85"
                        stroke={COLORS.primaryGold}
                        strokeWidth="1"
                        fill={COLORS.primaryGold}
                        opacity={0.3}
                    />

                    {/* Crescent on top */}
                    <Path
                        d="M98 58 Q96 52 100 50 Q97 52 98 58"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.8"
                        fill={COLORS.primaryGold}
                        opacity={0.6}
                    />

                    {/* Left small dome */}
                    <Path
                        d="M50 140 Q55 125 70 120 L70 140"
                        fill={COLORS.primaryGold}
                        opacity={0.15}
                    />
                    <Path
                        d="M50 140 Q55 125 70 120"
                        stroke={COLORS.primaryGold}
                        strokeWidth="1"
                        fill="none"
                    />

                    {/* Right small dome */}
                    <Path
                        d="M130 140 Q145 125 150 140"
                        fill={COLORS.primaryGold}
                        opacity={0.15}
                    />
                    <Path
                        d="M130 120 Q145 125 150 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="1"
                        fill="none"
                    />

                    {/* Left minaret */}
                    <Path
                        d="M52 140 L52 115 L54 110 L56 115 L56 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.8"
                        fill="none"
                    />

                    {/* Right minaret */}
                    <Path
                        d="M144 140 L144 115 L146 110 L148 115 L148 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.8"
                        fill="none"
                    />

                    {/* Base line */}
                    <Path
                        d="M40 140 L160 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="1"
                    />

                    {/* Door arch */}
                    <Path
                        d="M93 140 L93 125 Q93 118 100 118 Q107 118 107 125 L107 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.8"
                        fill={COLORS.primaryGold}
                        opacity={0.1}
                    />

                    {/* Window arches */}
                    <Path
                        d="M76 140 L76 130 Q76 126 80 126 Q84 126 84 130 L84 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                    <Path
                        d="M116 140 L116 130 Q116 126 120 126 Q124 126 124 130 L124 140"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                </G>

                {/* Decorative corner arcs */}
                <G opacity={0.2}>
                    <Path
                        d="M20 20 Q50 20 50 50"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                    <Path
                        d="M180 20 Q150 20 150 50"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                    <Path
                        d="M20 180 Q50 180 50 150"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                    <Path
                        d="M180 180 Q150 180 150 150"
                        stroke={COLORS.primaryGold}
                        strokeWidth="0.5"
                        fill="none"
                    />
                </G>
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
