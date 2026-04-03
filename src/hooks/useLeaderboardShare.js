/**
 * useLeaderboardShare
 * Captures the LeaderboardShareCard as a 1080×1920 PNG
 * and shares via react-native-share.
 *
 * Usage:
 *   const { shareRef, sharing, captureAndShare } = useLeaderboardShare();
 *   <ViewShot ref={shareRef} ...><LeaderboardShareCard ... /></ViewShot>
 *   <Button onPress={captureAndShare} />
 */
import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import RNShare from 'react-native-share';

export function useLeaderboardShare() {
    const shareRef = useRef(null);
    const [sharing, setSharing] = useState(false);

    const captureAndShare = useCallback(async () => {
        if (!shareRef.current) {
            Alert.alert('Error', 'Leaderboard card not ready yet.');
            return;
        }
        setSharing(true);
        try {
            const uri = await shareRef.current.capture({ format: 'png', result: 'tmpfile' });
            await RNShare.open({
                title: 'Clash of Imaan — Daily Leaderboard',
                message: '🏆 Look at the Clash of Imaan Daily Leaderboard! See where you rank. Download the app and join the Ramadan Daily Quizzes! 🌙',
                url: `file://${uri}`,
                type: 'image/png',
                failOnCancel: false,
            });
        } catch (err) {
            if (err?.message !== 'User did not share') {
                if (__DEV__) console.warn('[useLeaderboardShare] error:', err);
                Alert.alert('Share Failed', 'Could not generate the leaderboard image.');
            }
        } finally {
            setSharing(false);
        }
    }, []);

    return { shareRef, sharing, captureAndShare };
}
