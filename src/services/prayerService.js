import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import SunCalc from 'suncalc';

const LOCATION_TIMEOUT = 15000;
const MAXIMUM_AGE = 1000 * 60 * 10;
const PRE_DHUHR_WINDOW_MINUTES = 5;

function formatApiDate(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function cleanTimeLabel(value) {
    return String(value || '').split(' ')[0].trim();
}

function parseTime(value, baseDate = new Date()) {
    const cleaned = cleanTimeLabel(value);
    const [hoursRaw, minutesRaw] = cleaned.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
    }

    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

function formatClock(value) {
    const parsed = value instanceof Date ? value : parseTime(value);
    if (!parsed) return '--:--';

    return parsed.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function subtractMinutes(value, minutes) {
    const parsed = parseTime(value);
    if (!parsed) return null;
    parsed.setMinutes(parsed.getMinutes() - minutes);
    return parsed;
}

function addMinutes(value, minutes) {
    const parsed = parseTime(value);
    if (!parsed) return null;
    parsed.setMinutes(parsed.getMinutes() + minutes);
    return parsed;
}

async function requestLocationPermission() {
    if (Platform.OS === 'ios') {
        const status = await Geolocation.requestAuthorization('whenInUse');
        return status === 'granted';
    }

    const fineGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return fineGranted === PermissionsAndroid.RESULTS.GRANTED;
}

function getCurrentPosition(options = {}) {
    const { forceRefresh = false } = options;

    return new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
            position => {
                // Validate coordinates are reasonable
                const lat = position?.coords?.latitude;
                const lng = position?.coords?.longitude;
                if (typeof lat === 'number' && typeof lng === 'number' && 
                    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    resolve(position);
                } else {
                    reject(new Error('Invalid location coordinates'));
                }
            },
            error => reject(error),
            {
                enableHighAccuracy: true,
                timeout: LOCATION_TIMEOUT,
                maximumAge: forceRefresh ? 0 : MAXIMUM_AGE,
                forceRequestLocation: true,
                showLocationDialog: true,
                accuracy: {
                    android: 'high',
                    ios: 'bestForNavigation',
                },
            },
        );
    });
}

async function fetchHijri(date) {
    const url = `https://api.aladhan.com/v1/gToH?date=${formatApiDate(date)}`;
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || json?.code !== 200 || !json?.data) {
        throw new Error('Unable to fetch hijri date');
    }
    return json.data.hijri;
}

async function fetchAladhanTimings(latitude, longitude, date, madhab) {
    // Map madhab to Aladhan method id per project mapping: hanafi -> 1, shafi -> 2
    const methodId = madhab === 'shafi' ? 2 : 1;
    const url = `https://api.aladhan.com/v1/timings?date=${formatApiDate(date)}&latitude=${latitude}&longitude=${longitude}&method=${methodId}`;

    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || json?.code !== 200 || !json?.data) {
        throw new Error('Aladhan timings fetch failed');
    }

    // Return the data block which includes timings and date.hijri
    return json.data;
}

function calculatePrayerTimes(latitude, longitude, date, madhab) {
    const times = SunCalc.getTimes(date, latitude, longitude);
    const fajrAngle = madhab === 'hanafi' ? 18 : 15; // Hanafi: 18°, Shafi: 15°

    // Calculate Fajr: time when sun altitude = -fajrAngle before sunrise
    const fajr = findTimeForAltitude(date, latitude, longitude, -fajrAngle, times.sunrise, 0);
    
    // Calculate Isha: Fixed time after Maghrib (1.5 hours) - common practice
    const isha = new Date(times.sunset.getTime() + 1.5 * 60 * 60 * 1000);
    
    // Dhuhr is solar noon
    const dhuhr = times.solarNoon;
    
    // Asr calculation
    const asrFactor = madhab === 'hanafi' ? 2 : 1; // Hanafi: 2x shadow, Shafi: 1x
    const asr = calculateAsrTime(dhuhr, times.sunrise, latitude, asrFactor);
    
    // Imsak: Fajr minus 10 minutes
    const imsak = new Date(fajr.getTime() - 10 * 60 * 1000);
    
    return {
        Fajr: formatTime(fajr),
        Sunrise: formatTime(times.sunrise),
        Dhuhr: formatTime(dhuhr),
        Asr: formatTime(asr),
        Maghrib: formatTime(times.sunset),
        Isha: formatTime(isha),
        Imsak: formatTime(imsak),
    };
}

function findTimeForAltitude(date, lat, lng, targetAltitude, startTime, endHour) {
    // Binary search to find time when sun altitude = targetAltitude
    let start = new Date(startTime);
    let end = new Date(startTime);
    
    if (endHour === 0) {
        // Before sunrise, search from 12 hours before sunrise to sunrise
        start = new Date(startTime.getTime() - 12 * 60 * 60 * 1000);
        end = new Date(startTime);
    } else if (endHour === 24) {
        // After sunset, search from sunset to 12 hours after sunset
        start = new Date(startTime);
        end = new Date(startTime.getTime() + 12 * 60 * 60 * 1000);
    }

    for (let i = 0; i < 25; i++) { // More iterations for precision
        const mid = new Date((start.getTime() + end.getTime()) / 2);
        const pos = SunCalc.getPosition(mid, lat, lng);
        const altitude = pos.altitude * 180 / Math.PI; // Convert to degrees
        
        if ((endHour === 0 && altitude > targetAltitude) || (endHour === 24 && altitude < targetAltitude)) {
            if (endHour === 0) {
                end = mid;
            } else {
                start = mid;
            }
        } else {
            if (endHour === 0) {
                start = mid;
            } else {
                end = mid;
            }
        }
    }
    
    return new Date((start.getTime() + end.getTime()) / 2);
}

function calculateAsrTime(dhuhr, sunrise, latitude, factor) {
    // Asr time calculation based on shadow length
    const dhuhrTime = dhuhr.getTime();
    const sunriseTime = sunrise.getTime();
    const timeDiff = dhuhrTime - sunriseTime;
    
    // Adjusted formula: Asr = Dhuhr + (factor * timeDiff) / (factor + 2)
    const asrOffset = (factor * timeDiff) / (factor + 2);
    const asrTime = dhuhrTime + asrOffset;
    return new Date(asrTime);
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5); // HH:MM format
}

async function reverseGeocodeLocation(latitude, longitude, options = {}) {
    const { forceRefresh = false } = options;
    const cacheKey = `reverse_geocode_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
    const cached = forceRefresh ? null : await AsyncStorage.getItem(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        // Using Photon API for reverse geocoding (free, open source, based on OpenStreetMap)
        const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`;
        const response = await fetch(url);
        const json = await response.json();
        const features = json?.features || [];
        if (features.length > 0) {
            const props = features[0].properties;
            const locationName = props.city || props.town || props.village || props.county || props.state || 'Your area';
            await AsyncStorage.setItem(cacheKey, locationName);
            return locationName;
        }
        return 'Your area';
    } catch {
        return 'Your area';
    }
}

export async function getPrayerInfo(madhab = 'hanafi', options = {}) {
    const { forceRefresh = false } = options;
    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
        throw new Error('Location permission denied');
    }

    const position = await getCurrentPosition({ forceRefresh });
    const latitude = Number(position?.coords?.latitude);
    const longitude = Number(position?.coords?.longitude);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const cacheKey = `prayer_info_${today.toISOString().split('T')[0]}_${madhab}_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
    const cached = forceRefresh ? null : await AsyncStorage.getItem(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    // Prefer authoritative Aladhan timings by lat/lon; fall back to local SunCalc if Aladhan fails
    const [aladhanTodayData, aladhanTomorrowData, fetchedHijri, locationName] = await Promise.all([
        fetchAladhanTimings(latitude, longitude, today, madhab).catch(() => null),
        fetchAladhanTimings(latitude, longitude, tomorrow, madhab).catch(() => null),
        fetchHijri(today).catch(() => null),
        reverseGeocodeLocation(latitude, longitude, { forceRefresh }),
    ]);

    let todayTimes = null;
    let tomorrowTimes = null;
    let hijriDate = null;

    if (aladhanTodayData && aladhanTodayData.timings) {
        // Use Aladhan-provided timings
        const t = aladhanTodayData.timings;
        todayTimes = {
            Fajr: t.Fajr,
            Sunrise: t.Sunrise,
            Dhuhr: t.Dhuhr || t.Zuhr || t.Zuhr,
            Asr: t.Asr,
            Maghrib: t.Maghrib || t.Sunset,
            Isha: t.Isha,
            Imsak: t.Imsak || null,
        };
        if (aladhanTomorrowData && aladhanTomorrowData.timings) {
            const tt = aladhanTomorrowData.timings;
            tomorrowTimes = { Fajr: tt.Fajr };
        }
        hijriDate = aladhanTodayData.date?.hijri || fetchedHijri;
    } else {
        // Fallback to local calculation
        todayTimes = calculatePrayerTimes(latitude, longitude, today, madhab);
        tomorrowTimes = calculatePrayerTimes(latitude, longitude, tomorrow, madhab);
        hijriDate = fetchedHijri;
    }

    const beforeDhuhrStart = subtractMinutes(parseTime(todayTimes.Dhuhr), PRE_DHUHR_WINDOW_MINUTES);
    const afterFajrStart = addMinutes(parseTime(todayTimes.Fajr), 10); // Add 10 minutes buffer after Fajr

    const result = {
        coordinates: {
            latitude,
            longitude,
        },
        locationName,
        madhab,
        hijriDate,
        // Sehri: prefer Aladhan's Imsak when available. For Shafi apply -4 minutes adjustment.
        sehriTime: (function() {
            const imsak = todayTimes?.Imsak;
            if (!imsak) return '--:--';
            if (madhab === 'shafi') {
                const adj = subtractMinutes(imsak, 4);
                return formatClock(adj || imsak);
            }
            return formatClock(imsak);
        })(),
        iftarTime: formatClock(todayTimes.Maghrib),
        timings: {
            fajr: formatClock(todayTimes.Fajr),
            sunrise: formatClock(todayTimes.Sunrise),
            dhuhr: formatClock(todayTimes.Dhuhr),
            asr: formatClock(todayTimes.Asr),
            maghrib: formatClock(todayTimes.Maghrib),
            isha: formatClock(todayTimes.Isha),
            tomorrowFajr: formatClock(tomorrowTimes?.Fajr || ''),
        },
        makruhTimes: [
            {
                key: 'after-fajr',
                label: 'After Fajr',
                start: formatClock(afterFajrStart),
                end: formatClock(todayTimes.Sunrise),
            },
            {
                key: 'before-dhuhr',
                label: 'Before Dhuhr',
                start: formatClock(beforeDhuhrStart),
                end: formatClock(todayTimes.Dhuhr),
            },
            {
                key: 'after-asr',
                label: 'After Asr',
                start: formatClock(todayTimes.Asr),
                end: formatClock(todayTimes.Maghrib),
            },
        ],
        lastPrayerTimes: [
            { label: 'Fajr', end: formatClock(todayTimes.Sunrise) },
            { label: 'Dhuhr', end: formatClock(todayTimes.Asr) },
            { label: 'Asr', end: formatClock(todayTimes.Maghrib) },
            { label: 'Maghrib', end: formatClock(todayTimes.Isha) },
            { label: 'Isha', end: formatClock(tomorrowTimes.Fajr) },
        ],
    };

    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
}
