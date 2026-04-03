/**
 * useResultShare
 * Captures the ResultShareCard ref as a 1080×1080 PNG,
 * then shares the IMAGE via react-native-share (works on Android + iOS).
 * Included is custom message text for the user.
 *
 * Usage:
 *   const { shareRef, sharing, captureAndShare } = useResultShare(score, total, time);
 *   <ViewShot ref={shareRef} ...><ResultShareCard ... /></ViewShot>
 *   <Button onPress={captureAndShare} />
 */
import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import RNShare from 'react-native-share';

export function useResultShare() {
    const shareRef = useRef(null);
    const [sharing, setSharing] = useState(false);

    // captureAndShare accepts a payload so the caller can provide dynamic message
    // content depending on win/lose and opponent.
    const captureAndShare = useCallback(async ({ opponentName, isWin, score, total, timeSeconds } = {}) => {
        if (!shareRef.current) {
            Alert.alert('Error', 'Share card not ready yet.');
            return;
        }
        setSharing(true);
        try {
            const uri = await shareRef.current.capture({ format: 'png', result: 'tmpfile' });

            const resultVerb = isWin ? 'won' : 'completed';
            const baseMessage = isWin
                ? `MashaAllah! I won a Clash of Imaan challenge with ${opponentName || 'a family member'} — ${score}/${total} in ${timeSeconds} seconds.`
                : `I completed a Clash of Imaan challenge with ${opponentName || 'a family member'} — ${score}/${total} in ${timeSeconds} seconds. Keep learning!`;

            await RNShare.open({
                title: 'Clash of Imaan — Result',
                message: baseMessage,
                url: `file://${uri}`,
                type: 'image/png',
                failOnCancel: false,
            });
        } catch (err) {
            if (err?.message !== 'User did not share') {
                if (__DEV__) console.warn('[useResultShare] capture/share error:', err);
                Alert.alert('Share Failed', 'Could not generate the share image. Please try again.');
            }
        } finally {
            setSharing(false);
        }
    }, []);

    return { shareRef, sharing, captureAndShare };
}
