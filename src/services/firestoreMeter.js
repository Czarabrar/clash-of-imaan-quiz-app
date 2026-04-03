import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'firestore_meter_v1';
let reads = 0;
let writes = 0;

async function load() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        reads = parsed.reads || 0;
        writes = parsed.writes || 0;
    } catch (e) {
        // ignore
    }
}

async function persist() {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ reads, writes }));
    } catch (e) {
        // ignore
    }
}

function incRead(n = 1) {
    reads += n;
    persist();
}

function incWrite(n = 1) {
    writes += n;
    persist();
}

function getCounts() {
    return { reads, writes };
}

async function resetCounts() {
    reads = 0;
    writes = 0;
    await persist();
}

// Initialize from storage (best-effort)
load().catch(() => {});

export { incRead, incWrite, getCounts, resetCounts };
