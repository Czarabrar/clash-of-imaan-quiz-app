import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    StatusBar,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getPrayerInfo } from '../services/prayerService';
import { BORDER_RADIUS, COLORS, GRADIENTS, SHADOWS, SPACING, TYPOGRAPHY, FONT_SIZES } from '../theme';
import RAMADAN_TIMES from '../config/ramadanTimes';

export default function HomeScreen({ navigation }) {
    const { userProfile } = useAuth();
    const [prayerData, setPrayerData] = useState(null);
    console.log('DEBUG [HomeScreen] prayerData:', prayerData);
    const [selectedMadhab, setSelectedMadhab] = useState('hanafi');

    const loadPrayerInfo = useCallback(async (madhab, forceRefresh = false) => {
        console.log('DEBUG [HomeScreen] loadPrayerInfo called with madhab:', madhab);
        try {
            const data = await getPrayerInfo(madhab, { forceRefresh });
            console.log('DEBUG [HomeScreen] getPrayerInfo result:', !!data);
            setPrayerData(data);
        } catch (error) {
            console.error('DEBUG [HomeScreen] Prayer fetch fail:', error);
            if (__DEV__) console.warn('Prayer fetch fail:', error);
        }
    }, []);

    useEffect(() => {
        loadPrayerInfo(selectedMadhab, false);
    }, [loadPrayerInfo, selectedMadhab]);

    const cards = [
        {
            key: 'daily',
            icon: 'book-open-variant',
            title: 'Daily Quiz',
            subtitle: "Answer today's question before others to earn points",
            onPress: () => navigation.navigate('DailyQuiz', { autoStart: true }),
            backgroundColor: '#E8F3D6',
        },
        {
            key: 'family',
            icon: 'account-group-outline',
            title: 'Challenge Your Family',
            subtitle: 'Invite a family member to a 1v1 quiz battle',
            onPress: () => navigation.navigate('Arena'),
            backgroundColor: '#C8DBBE',
        },
        {
            key: 'qadr',
            icon: 'moon-full',
            title: 'Lailatul Qadr Challenge',
            subtitle: 'Answer daily questions for 10 days to earn your certificate',
            onPress: () => navigation.navigate('MonthlyChallenge'),
            backgroundColor: '#D2DAFF',
        },
    ];

    const colorPalette = ['C7D9DD','FFDCCC','FCE7C8','D4F6FF','E7CCCC'];

    const duas = [
        {
            id: 1,
            arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
            urduMeaning: "اے اللہ! بے شک تو معاف کرنے والا ہے اور معافی کو پسند کرتا ہے، پس مجھے بھی معاف فرما۔",
            reference: "سنن ترمذی",
        },
        {
            id: 2,
            arabic: "رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ",
            urduMeaning: "اے میرے رب! مجھے بخش دے اور میری توبہ قبول فرما، بے شک تو ہی بہت توبہ قبول کرنے والا اور نہایت رحم کرنے والا ہے۔",
            reference: "سنن ابوداؤد",
        },
        {
            id: 3,
            arabic: "رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ",
            urduMeaning: "اے ہمارے رب! ہم نے اپنی جانوں پر ظلم کیا، اگر تو ہمیں معاف نہ کرے اور ہم پر رحم نہ فرمائے تو ہم یقیناً خسارہ پانے والوں میں سے ہو جائیں گے۔",
            reference: "الاعراف 7:23",
        },
        {
            id: 4,
            arabic: "اللَّهُمَّ أَجِرْنِي مِنَ النَّارِ",
            urduMeaning: "اے اللہ! مجھے جہنم کی آگ سے بچا لے۔",
            reference: "سنن ابوداؤد",
        },
        {
            id: 5,
            arabic: "رَبَّنَا اغْفِرْ لَنَا ذُنُوبَنَا وَإِسْرَافَنَا فِي أَمْرِنَا وَثَبِّتْ أَقْدَامَنَا وَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ",
            urduMeaning: "اے ہمارے رب! ہمارے گناہ اور ہماری زیادتیاں معاف فرما، ہمیں ثابت قدم رکھ اور ہمیں حق پر کامیابی عطا فرما۔",
            reference: "آل عمران 3:147",
        },
    ];

    const userName = userProfile?.name || 'Friend';
    const hijriDate = prayerData?.hijriDate;
    const sehriTime = prayerData?.sehriTime || RAMADAN_TIMES.sehriTime;
    const iftarTime = prayerData?.iftarTime || RAMADAN_TIMES.iftarTime;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.lanternPurple} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>
                <LinearGradient
                    colors={GRADIENTS.ramadanNight}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}>
                    <Text style={styles.greeting}>Assalamu Alaikum,</Text>
                    <Text style={styles.welcome}>Welcome back {userName}</Text>

                    {hijriDate && (
                        <Text style={styles.hijriDate}>
                            {hijriDate.day} {hijriDate.month.en} {hijriDate.year}
                        </Text>
                    )}

                    <View style={styles.madhabCard}>
                        <View style={styles.madhabRow}>
                            <TouchableOpacity
                                style={[styles.madhabButton, selectedMadhab === 'hanafi' && styles.madhabButtonActive]}
                                onPress={() => setSelectedMadhab('hanafi')}>
                                <Text style={[styles.madhabButtonText, selectedMadhab === 'hanafi' && styles.madhabButtonTextActive]}>Hanafi</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.madhabButton, selectedMadhab === 'shafi' && styles.madhabButtonActive]}
                                onPress={() => setSelectedMadhab('shafi')}>
                                <Text style={[styles.madhabButtonText, selectedMadhab === 'shafi' && styles.madhabButtonTextActive]}>Shafi</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.pillsRow}>
                            <View style={styles.timePill}>
                                <Text style={styles.timePillText}>Sehri • {sehriTime}</Text>
                            </View>
                            <View style={styles.timePill}>
                                <Text style={styles.timePillText}>Iftar • {iftarTime}</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.contentArea}>
                    {cards.map(card => (
                        <TouchableOpacity
                            key={card.key}
                            style={[styles.actionCard, { backgroundColor: card.backgroundColor }]}
                            activeOpacity={0.85}
                            onPress={card.onPress}>
                            <View style={styles.actionIconWrap}>
                                <Icon name={card.icon} size={22} color={COLORS.primaryGold} />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>{card.title}</Text>
                                <Text style={styles.actionSubtitle}>{card.subtitle}</Text>
                            </View>
                            <Icon name="chevron-right" size={22} color={COLORS.lightBrown} />
                        </TouchableOpacity>
                    ))}

                        {/* Dua carousel next to Lailatul Qadr — horizontal scrollable */}
                        <View style={{ marginTop: SPACING.lg }}>
                            <Text style={[TYPOGRAPHY.heading, { fontSize: FONT_SIZES.md, color: COLORS.darkBrown, marginBottom: SPACING.sm }]}>Duas for Lailatul Qadr</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.duaCarousel}>
                                {duas.map((d, i) => (
                                    <View key={d.id} style={[styles.duaCard, { backgroundColor: `#${colorPalette[i % colorPalette.length]}` }]}>
                                        <Text style={styles.duaArabic} numberOfLines={2}>{d.arabic}</Text>
                                        <Text style={styles.duaUrdu} numberOfLines={4}>{d.urduMeaning}</Text>
                                        <Text style={styles.duaRef}>{d.reference}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                </View>
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
        paddingBottom: 120,
    },
    header: {
        paddingTop: SPACING.xxxl + 8,
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xl,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    greeting: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.md,
        color: COLORS.white,
    },
    welcome: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.hero,
        color: COLORS.primaryGold, // Changed from white to golden
        marginTop: SPACING.xs,
    },
    locationText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.xs,
        color: COLORS.white,
        flex: 1,
        marginLeft: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.sm,
    },
    refreshIcon: {
        padding: SPACING.xs,
    },
    pillsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        flexWrap: 'wrap',
    },
    timePill: {
        borderRadius: BORDER_RADIUS.pill,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    timePillText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.sm,
        color: COLORS.white,
    },
    hijriDate: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.md,
        color: COLORS.white,
        textAlign: 'left',
        marginTop: SPACING.xs,
    },
    madhabCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginTop: SPACING.md,
    },
    madhabRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    madhabButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.pill,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    madhabButtonActive: {
        backgroundColor: COLORS.primaryGold,
        borderColor: COLORS.primaryGold,
    },
    madhabButtonText: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.xs,
        color: 'rgba(255,255,255,0.8)',
    },
    madhabButtonTextActive: {
        color: COLORS.white,
    },
    contentArea: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
    },
    loadingWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    loadingText: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
    },
    errorText: {
        ...TYPOGRAPHY.body,
        color: COLORS.error,
        marginBottom: SPACING.md,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.creamBorder,
        ...SHADOWS.card,
    },
    actionIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    actionTextWrap: {
        flex: 1,
    },
    actionTitle: {
        ...TYPOGRAPHY.heading,
        fontSize: FONT_SIZES.lg,
        color: COLORS.darkBrown,
    },
    actionSubtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.lightBrown,
        marginTop: 4,
        lineHeight: 18,
    },
    duaCarousel: {
        paddingVertical: 8,
        paddingRight: SPACING.xl,
    },
    duaCard: {
        width: 320,
        minHeight: 140,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        marginRight: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
        ...SHADOWS.card,
    },
    duaArabic: {
        fontSize: 21,
        color: COLORS.darkBrown,
        textAlign: 'right',
        marginBottom: SPACING.sm,
        lineHeight: 34,
        fontWeight: '700',
    },
    duaUrdu: {
        fontSize: FONT_SIZES.lg,
        color: COLORS.lanternPurple,
        marginBottom: SPACING.xs,
        lineHeight: 20,
    },
    duaRef: {
        fontSize: 12,
        color: COLORS.lightBrown,
        textAlign: 'left',
    },
});
