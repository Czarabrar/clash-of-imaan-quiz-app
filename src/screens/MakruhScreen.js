import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getPrayerInfo } from '../services/prayerService';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING, TYPOGRAPHY } from '../theme';

export default function MakruhScreen({ navigation }) {
    const [madhab, setMadhab] = useState('hanafi');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [prayerInfo, setPrayerInfo] = useState(null);
    const [errorText, setErrorText] = useState('');

    const loadData = useCallback(async (selectedMadhab = madhab, forceRefresh = false) => {
        try {
            setLoading(true);
            setErrorText('');
            const data = await getPrayerInfo(selectedMadhab, { forceRefresh });
            setPrayerInfo(data);
        } catch (error) {
            setErrorText(error?.message || 'Unable to load makruh timings.');
            console.error('MakruhScreen - Error loading prayer info:', error);
        } finally {
            setLoading(false);
        }
    }, [madhab]);

    useEffect(() => {
        loadData(madhab);
    }, [loadData, madhab]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData(madhab, true);
        setRefreshing(false);
    }, [loadData, madhab]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primaryGold}
                        colors={[COLORS.primaryGold]}
                    />
                }>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color={COLORS.darkBrown} />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Makruh Time</Text>
                <View style={styles.subtitleRow}>
                    <Text style={styles.subtitle}>Prayer times • {prayerInfo?.locationName || 'Your area'}</Text>
                    <TouchableOpacity onPress={() => loadData(madhab, true)} style={styles.refreshIcon}>
                        <Icon name="refresh" size={20} color={COLORS.primaryGold} />
                    </TouchableOpacity>
                </View>

                <View style={styles.selectorRow}>
                    {['hanafi', 'shafi'].map(option => (
                        <TouchableOpacity
                            key={option}
                            style={[styles.selectorPill, madhab === option && styles.selectorPillActive]}
                            onPress={() => setMadhab(option)}>
                            <Text style={[styles.selectorText, madhab === option && styles.selectorTextActive]}>
                                {option === 'hanafi' ? 'Hanafi' : 'Shafi'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>Makruh Time Today</Text>

                {loading ? (
                    <View style={styles.centerWrap}>
                        <ActivityIndicator size="small" color={COLORS.primaryGold} />
                        <Text style={styles.helperText}>Loading timings...</Text>
                    </View>
                ) : errorText ? (
                    <Text style={styles.errorText}>{errorText}</Text>
                ) : (
                    <View style={styles.tableWrap}>
                        {prayerInfo?.makruhTimes?.map((item, index) => (
                            <View key={item.key || item.label} style={[styles.tableRow, index > 0 && styles.rowBorder]}>
                                <View>
                                    <Text style={styles.rowTitle}>{item.label}</Text>
                                    <Text style={styles.rowTime}>{item.start} → {item.end}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {!loading && !errorText && prayerInfo?.lastPrayerTimes?.length ? (
                    <>
                        <Text style={styles.sectionTitleSecondary}>Last Prayer Time Today</Text>
                        <View style={styles.tableWrap}>
                            {prayerInfo.lastPrayerTimes.map((item, index) => (
                                <View key={item.label} style={[styles.tableRowInline, index > 0 && styles.rowBorder]}>
                                    <Text style={styles.rowTitle}>{item.label}</Text>
                                    <Text style={styles.rowTimeSingle}>{item.end}</Text>
                                </View>
                            ))}
                        </View>
                    // MakruhScreen removed: replaced with a minimal stub to avoid import errors.
                    import React from 'react';
                    import { View } from 'react-native';

                    export default function MakruhScreen() {
                        return <View />;
                    }
const styles = StyleSheet.create({
