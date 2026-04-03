/**
 * Login Screen — Email/Password with Beige-Gold theme
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services/firebaseService';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await authService.signIn(email.trim(), password);
            // Navigation is handled automatically by AppNavigator's auth state listener.
            // No manual navigation.reset() needed.
        } catch (error) {
            setLoading(false);
            const code = error?.code || '';

            if (code === 'auth/user-not-found') {
                Alert.alert(
                    "Account Not Found",
                    "You do not have an account. Please sign up first."
                );
                return;
            }

            let message = 'Login failed. Please try again.';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                message = 'Invalid email or password.';
            } else if (code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            } else if (code === 'auth/too-many-requests') {
                message = 'Too many attempts. Please wait a moment and try again.';
            } else if (code === 'auth/network-request-failed') {
                message = 'No internet connection. Please check your network.';
            }
            Alert.alert('Sign In Failed', message);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.appName}>Clash of Imaan</Text>
                    <Text style={styles.tagline}>Ramazan Tournament</Text>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
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
                            placeholder="Password"
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
                        style={styles.loginButton}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}>
                        {loading ? (
                            <ActivityIndicator color={COLORS.cardBackground} />
                        ) : (
                            <Text style={styles.loginButtonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.signUpLink}
                        onPress={() => navigation.navigate('SignUp')}
                        disabled={loading}>
                        <Text style={styles.signUpText}>
                            Don't have an account?{' '}
                            <Text style={styles.signUpTextBold}>Sign Up</Text>
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Decorative */}
                <View style={styles.decorLine} />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: SPACING.xxl,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxxl + 16,
    },
    appName: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.display,
        color: COLORS.primaryGold,
        letterSpacing: 1,
    },
    tagline: {
        ...TYPOGRAPHY.caption,
        fontSize: FONT_SIZES.md,
        color: COLORS.lightBrown,
        marginTop: SPACING.xs,
        letterSpacing: 2,
        textTransform: 'uppercase',
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
    loginButton: {
        backgroundColor: COLORS.primaryGold,
        borderRadius: BORDER_RADIUS.pill,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.sm,
        ...SHADOWS.elevated,
    },
    loginButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.cardBackground,
        letterSpacing: 1,
    },
    signUpLink: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    signUpText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
    },
    signUpTextBold: {
        color: COLORS.primaryGold,
        fontWeight: '700',
    },
    decorLine: {
        width: 40,
        height: 3,
        backgroundColor: COLORS.primaryGold,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: SPACING.xxxl,
        opacity: 0.4,
    },
});
