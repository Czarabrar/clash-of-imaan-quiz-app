import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Keyboard, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, SHADOWS, BORDER_RADIUS, SPACING } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_ICONS = {
    Home: 'home-outline',
    Arena: 'sword-cross',
    Leaderboard: 'trophy-outline',
    Profile: 'account-outline',
    Admin: 'chart-bar',
};

const TAB_LABELS = {
    Home: 'Home',
    Arena: 'Challenge',
    Leaderboard: 'Leaderboard',
    Profile: 'Profile',
    Admin: 'Admin',
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function TabButton({ route, isFocused, onPress, onLongPress }) {
    const scale = useSharedValue(1);
    const iconName = TAB_ICONS[route.name] || 'circle';
    const label = TAB_LABELS[route.name] || route.name;

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.05 : 1, { damping: 15 });
    }, [isFocused, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedTouchable
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.tabButton, animatedStyle]}
            activeOpacity={0.7}>
            <Icon
                name={iconName}
                size={22}
                color={isFocused ? COLORS.primaryGold : COLORS.lightBrown}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]} numberOfLines={1}>
                {label}
            </Text>
            {isFocused && <View style={styles.activeIndicator} />}
        </AnimatedTouchable>
    );
}

export default function CustomTabBar({ state, descriptors, navigation, isAdmin }) {
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    if (keyboardVisible) {
        return null;
    }

    return (
        <View style={styles.outerContainer}>
            <LinearGradient
                colors={[COLORS.cardBackground, COLORS.cream]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.container}>
                {state.routes.map((route, index) => {
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({ type: 'tabLongPress', target: route.key });
                    };

                    return (
                        <TabButton
                            key={route.key}
                            route={route}
                            isFocused={isFocused}
                            onPress={onPress}
                            onLongPress={onLongPress}
                        />
                    );
                })}
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        position: 'absolute',
        bottom: SPACING.lg,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    container: {
        flexDirection: 'row',
        borderRadius: BORDER_RADIUS.pill,
        height: 78,
        width: SCREEN_WIDTH - 32,
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
        ...SHADOWS.navigation,
    },
    tabButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: 6,
        flex: 1,
    },
    tabLabel: {
        marginTop: 4,
        fontSize: 11,
        color: COLORS.lightBrown,
        fontWeight: '600',
    },
    tabLabelFocused: {
        color: COLORS.darkBrown,
    },
    activeIndicator: {
        width: 20,
        height: 3,
        backgroundColor: COLORS.primaryGold,
        borderRadius: 2,
        marginTop: 4,
    },
});
