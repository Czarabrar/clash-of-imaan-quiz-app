/**
 * Sign Up Screen — Registration with beige-gold theme
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { authService } from '../services/firebaseService';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';

export default function SignUpScreen({ navigation }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSignUp = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await authService.signUp(email.trim(), password, name.trim());
            // AuthContext's onAuthStateChanged takes over routing to Main.
            setLoading(false);
        } catch (error) {
            setLoading(false);
            const code = error?.code || '';
            let message = 'Registration failed. Please try again.';
            if (code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Try signing in instead.';
            } else if (code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            } else if (code === 'auth/weak-password') {
                message = 'Password is too weak. Use at least 6 characters.';
            } else if (code === 'auth/network-request-failed') {
                message = 'No internet connection. Please check your network.';
            }
            Alert.alert('Sign Up Failed', message);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled">
                {/* Back button - only show if there's a screen to go back to */}
                {navigation.canGoBack() && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        disabled={loading}>
                        <Icon name="arrow-left" size={22} color={COLORS.darkBrown} />
                    </TouchableOpacity>
                )}

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Create New Account</Text>
                    <Text style={styles.subtitle}>Join the Ramazan tournament</Text>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}>
                        <Icon name="account-outline" size={20} color={COLORS.lightBrown} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full name"
                            placeholderTextColor={COLORS.lightBrown}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Icon name="email-outline" size={20} color={COLORS.lightBrown} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email address"
                            placeholderTextColor={COLORS.lightBrown}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Icon name="lock-outline" size={20} color={COLORS.lightBrown} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password (min 6 characters)"
                            placeholderTextColor={COLORS.lightBrown}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            editable={!loading}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Icon
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={COLORS.lightBrown}
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.signUpButton}
                        onPress={handleSignUp}
                        disabled={loading}
                        activeOpacity={0.8}>
                        {loading ? (
                            <ActivityIndicator color={COLORS.cardBackground} />
                        ) : (
                            <Text style={styles.signUpButtonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.loginLink}
                        onPress={() => navigation.navigate('Login')}
                        disabled={loading}>
                        <Text style={styles.loginText}>
                            Already have an account?{' '}
                            <Text style={styles.loginTextBold}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.xxl,
    },
    backButton: {
        position: 'absolute',
        top: SPACING.xxl + 16,
        left: SPACING.xxl,
        padding: SPACING.sm,
    },
    header: {
        marginBottom: SPACING.xxxl,
    },
    title: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.hero,
        color: COLORS.darkBrown,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        marginTop: SPACING.xs,
    },
    formContainer: {
        gap: SPACING.lg,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.lg,
        height: 52,
        gap: SPACING.md,
        ...SHADOWS.card,
    },
    input: {
        flex: 1,
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        paddingVertical: 0,
    },
    signUpButton: {
        backgroundColor: COLORS.primaryGold,
        borderRadius: BORDER_RADIUS.pill,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.sm,
        ...SHADOWS.elevated,
    },
    signUpButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.cardBackground,
        letterSpacing: 1,
    },
    loginLink: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    loginText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
    },
    loginTextBold: {
        color: COLORS.primaryGold,
        fontWeight: '700',
    },
});
