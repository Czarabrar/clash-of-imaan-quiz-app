/**
 * SplashScreen — Shown once after first successful login/signup.
 * Uses AsyncStorage to track whether it's been seen before.
 * Animation: short logo pop-in, brief hold, then fade out.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Dimensions,
    StatusBar,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const { height: screenHeight } = Dimensions.get('screen');
const SPLASH_SEEN_KEY = '@clash_of_imaan_splash_seen';

export default function SplashScreen({ onFinish }) {
    const bgOpacity = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0.82)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;

    const runAnimation = useCallback(() => {
        Animated.timing(bgOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start(() => {
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    tension: 75,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 320,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setTimeout(async () => {
                    try {
                        await AsyncStorage.setItem(SPLASH_SEEN_KEY, 'true');
                    } catch (_) { }

                    Animated.parallel([
                        Animated.timing(bgOpacity, {
                            toValue: 0,
                            duration: 280,
                            useNativeDriver: true,
                        }),
                        Animated.timing(logoOpacity, {
                            toValue: 0,
                            duration: 280,
                            useNativeDriver: true,
                        }),
                    ]).start(() => onFinish?.());
                }, 2300);
            });
        });
    }, [bgOpacity, logoOpacity, logoScale, onFinish]);

    useEffect(() => {
        runAnimation();
    }, [runAnimation]);

    return (
        <Animated.View style={[styles.container, { opacity: bgOpacity }]}>
            <StatusBar
                translucent={false}
                backgroundColor="#FFFFFF"
                barStyle="dark-content"
            />
            <Animated.Image
                source={require('../assets/logo-new.png')}
                style={[
                    styles.logo,
                    {
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }],
                    },
                ]}
                resizeMode="contain"
            />

        </Animated.View>
    );
}

const LOGO_SIZE = width * 0.713;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        width,
        height: Platform.OS === 'android' ? screenHeight : '100%',
        zIndex: 999,
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        borderRadius: 24,
    },
});

export { SPLASH_SEEN_KEY };
