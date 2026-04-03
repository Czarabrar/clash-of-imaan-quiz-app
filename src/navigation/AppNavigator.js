/**
 * AppNavigator — Auth-state-driven routing with simplified tabs.
 */
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { OneSignal } from 'react-native-onesignal';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { UsersProvider } from '../context/UsersContext';
import { ArenaProvider } from '../context/ArenaContext';
import { COLORS } from '../theme';

import CustomTabBar from './CustomTabBar';
import HomeScreen from '../screens/HomeScreen';
import ArenaScreen from '../screens/ArenaScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import MarathonScreen from '../screens/MarathonScreen';
import DailyQuizScreen from '../screens/DailyQuizScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SplashScreen, { SPLASH_SEEN_KEY } from '../screens/SplashScreen';
import CeremonyScreen from '../screens/CeremonyScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function ArenaStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ArenaMain" component={ArenaScreen} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} />
        </Stack.Navigator>
    );
}

function MainTabs() {
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';

    return (
        <Tab.Navigator
            tabBar={props => <CustomTabBar {...props} isAdmin={isAdmin} />}
            screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Arena" component={ArenaStack} />
            <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
            {isAdmin && <Tab.Screen name="Admin" component={AdminScreen} />}
        </Tab.Navigator>
    );
}

/**
 * RootNavigator reads auth state from AuthContext and decides which stack
 * to show. This runs INSIDE NavigationContainer and INSIDE AuthProvider,
 * so it can safely call useAuth() and navigation hooks.
 */
function RootNavigator() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={styles.splash}>
                <ActivityIndicator size="large" color={COLORS.primaryGold} />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
                <>
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen name="DailyQuiz" component={DailyQuizScreen} />
                    <Stack.Screen name="MonthlyChallenge" component={MarathonScreen} />
                    <Stack.Screen name="Ceremony" component={CeremonyScreen} />
                </>
            ) : (
                <>
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="Login" component={LoginScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}

function GlobalNotificationHandler() {
    const navigation = useNavigation();

    useEffect(() => {
        const clickListener = (event) => {
            const data = event?.notification?.additionalData;
            if (data?.screen) {
                // Route the user to the specified screen (e.g. 'Arena')
                navigation.navigate(data.screen);
            }
        };

        OneSignal.Notifications.addEventListener('click', clickListener);
        return () => {
            OneSignal.Notifications.removeEventListener('click', clickListener);
        };
    }, [navigation]);

    return null;
}

function AppShell({ showSplash, onSplashFinish }) {
    const { user } = useAuth();

    return (
        <>
            <NavigationContainer>
                {user && <GlobalNotificationHandler />}
                <RootNavigator />
            </NavigationContainer>
            {showSplash && user ? (
                <SplashScreen onFinish={onSplashFinish} />
            ) : null}
        </>
    );
}

export default function AppNavigator() {
    const [showSplash, setShowSplash] = useState(null); // null = not yet checked

    useEffect(() => {
        AsyncStorage.getItem(SPLASH_SEEN_KEY)
            .then(val => setShowSplash(val !== 'true'))
            .catch(() => setShowSplash(false));
    }, []);

    // Still checking storage — render nothing (instant)
    if (showSplash === null) return null;

    return (
        <AuthProvider>
            <UsersProvider>
                <ArenaProvider>
                    <AppShell
                        showSplash={showSplash}
                        onSplashFinish={() => setShowSplash(false)}
                    />
                </ArenaProvider>
            </UsersProvider>
        </AuthProvider>
    );
}

const styles = StyleSheet.create({
    splash: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
});
