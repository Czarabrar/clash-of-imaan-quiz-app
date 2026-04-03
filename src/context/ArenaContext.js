import React, { createContext, useContext, useState, useEffect } from 'react';
import questionBank from '../data/questionBank.json';
import firestore from '@react-native-firebase/firestore';

const ArenaContext = createContext();

export const ArenaProvider = ({ children }) => {
    const [arenaQuestions, setArenaQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const syncQuestions = async () => {
            try {
                // Initialize with local bank first for immediate availability.
                // Assign stable IDs to every local question so that handleAnswer can
                // store a valid questionId in the answer objects. Questions loaded from
                // Firestore already carry their doc.id; local-only questions get
                // "local_<index>" as a stable fallback.
                setArenaQuestions(questionBank.map((q, i) => ({ ...q, id: q.id ?? `local_${i}` })));

                // Then try to fetch fresh batch from Firestore arenaQuestions
                // This keeps the bank updated without per-match reads
                const snapshot = await firestore().collection('arenaQuestions').get();
                if (!snapshot.empty) {
                    const cloudQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Merge local and cloud - prefer cloud questions if IDs overlap
                    setArenaQuestions(prev => {
                        const merged = [...prev];
                        cloudQuestions.forEach(cq => {
                            const idx = merged.findIndex(q => q.id === cq.id);
                            if (idx >= 0) merged[idx] = cq;
                            else merged.push(cq);
                        });
                        return merged;
                    });
                }
            } catch (e) {
                if (__DEV__) console.warn('Arena sync failed, using local bank:', e);
            } finally {
                setLoading(false);
            }
        };

        syncQuestions();
    }, []);

    const getRandomQuestions = (count = 10) => {
        if (arenaQuestions.length === 0) return [];
        const shuffled = [...arenaQuestions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    // PRNG for consistent seeds across players
    const getSeededQuestions = (seedStr, count = 10) => {
        if (arenaQuestions.length === 0) return [];
        if (!seedStr) return getRandomQuestions(count);

        // Incorporate Day of Year to ensure variety even with recycled seeds
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const finalSeedStr = `${seedStr}_${dayOfYear}`;

        const cyrb128 = (str) => {
            let h1 = 1779033703, h2 = 3144134277,
                h3 = 1013904242, h4 = 2773480762;
            for (let i = 0, k; i < str.length; i++) {
                k = str.charCodeAt(i);
                h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
                h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
                h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
                h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
            }
            h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
            h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
            h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
            h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
            h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
            return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
        };

        const sfc32 = (a, b, c, d) => {
            return function () {
                a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
                var t = (a + b) | 0;
                a = b ^ b >>> 9;
                b = c + (c << 3) | 0;
                c = (c << 21 | c >>> 11);
                d = d + 1 | 0;
                t = t + d | 0;
                c = c + t | 0;
                return (t >>> 0) / 4294967296;
            }
        };

        const seed = cyrb128(finalSeedStr.toString());
        const rand = sfc32(seed[0], seed[1], seed[2], seed[3]);

        // Fisher-Yates Shuffle for deterministic consistency across all JS engines
        const shuffled = [...arenaQuestions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    return (
        <ArenaContext.Provider value={{ arenaQuestions, loading, getRandomQuestions, getSeededQuestions }}>
            {children}
        </ArenaContext.Provider>
    );
};

export const useArena = () => {
    const context = useContext(ArenaContext);
    if (!context) {
        throw new Error('useArena must be used within an ArenaProvider');
    }
    return context;
};
