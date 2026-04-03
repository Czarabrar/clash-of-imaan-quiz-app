import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Alert,
    Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONT_SIZES, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAuth } from '../context/AuthContext';

const DEVELOPER_PORTFOLIO_URL = 'https://czarabrar.github.io/Portfolio/';

export default function ProfileScreen() {
    const { userProfile, signOut } = useAuth();

    const safeProfile = userProfile || {
        name: 'User',
        email: '',
        matchesPlayed: 0,
        challengesWon: 0,
        totalOverallPoints: 0,
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Do you want to logout now?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut();
                        } catch {
                            Alert.alert('Error', 'Failed to logout.');
                        }
                    },
                },
            ],
        );
    };

    const handleOpenDeveloperPortfolio = async () => {
        try {
            // Try canOpenURL first; on some devices this can return false for https.
            const supported = await Linking.canOpenURL(DEVELOPER_PORTFOLIO_URL);
            if (supported) {
                await Linking.openURL(DEVELOPER_PORTFOLIO_URL);
                return;
            }

            // Fallback: attempt to open directly (some Android setups allow this)
            await Linking.openURL(DEVELOPER_PORTFOLIO_URL).catch(() => {
                throw new Error('open-failed');
            });
        } catch (err) {
            Alert.alert('Unavailable', 'Unable to open the developer portfolio right now.');
        }
    };

    const statRows = [
        { label: 'Name', value: safeProfile.name, icon: 'account-outline' },
        { label: 'Email', value: safeProfile.email || 'Not available', icon: 'email-outline' },
        { label: 'Matches Played', value: String(safeProfile.matchesPlayed || 0), icon: 'sword-cross' },
        { label: 'Wins', value: String(safeProfile.challengesWon || 0), icon: 'trophy-outline' },
        { label: 'Points', value: String(safeProfile.totalOverallPoints || 0), icon: 'star-circle-outline' },
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.headerCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{safeProfile.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.title}>Profile</Text>
                </View>

                <View style={styles.statsCard}>
                    {statRows.map((row, index) => (
                        <View key={row.label}>
                            <View style={styles.statRow}>
                                <View style={styles.statLeft}>
                                    <Icon name={row.icon} size={20} color={COLORS.primaryGold} />
                                    <Text style={styles.statLabel}>{row.label}</Text>
                                </View>
                                <Text style={styles.statValue}>{row.value}</Text>
                            </View>
                            {index < statRows.length - 1 && <View style={styles.divider} />}
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenDeveloperPortfolio}>
                    <Icon name="account-tie-outline" size={20} color={COLORS.darkBrown} />
                    <Text style={styles.secondaryButtonText}>About Developer</Text>
                    <Icon name="open-in-new" size={18} color={COLORS.darkBrown} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Icon name="logout" size={20} color={COLORS.white} />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
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
        padding: SPACING.xl,
        paddingBottom: 120,
    },
    headerCard: {
        alignItems: 'center',
        marginTop: SPACING.xxl + 10,
        marginBottom: SPACING.xl,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
        ...SHADOWS.card,
    },
    avatar: {
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: COLORS.softGreen,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.primaryGold,
    },
    avatarText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.display,
        color: COLORS.primaryGold,
    },
    title: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.hero,
        color: COLORS.darkBrown,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginTop: 4,
    },
    statsCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        paddingHorizontal: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
        ...SHADOWS.card,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.lg,
        gap: SPACING.md,
    },
    statLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        flex: 1,
    },
    statLabel: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    },
    statValue: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
        maxWidth: '52%',
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.beigeDark,
    },
    secondaryButton: {
        marginTop: SPACING.xl,
        backgroundColor: '#F3E6C8',
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.xl,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.primaryGold,
        ...SHADOWS.card,
    },
    secondaryButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.darkBrown,
    },
    logoutButton: {
        marginTop: SPACING.xl,
        backgroundColor: COLORS.error,
        borderRadius: BORDER_RADIUS.pill,
        paddingVertical: SPACING.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.sm,
        ...SHADOWS.card,
    },
    logoutButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.white,
    },
});
