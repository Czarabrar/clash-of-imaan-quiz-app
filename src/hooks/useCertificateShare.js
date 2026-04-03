/**
 * useCertificateShare — Capture CertificateShareCard via ViewShot, share as PNG.
 */
import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import RNShare from 'react-native-share';

export function useCertificateShare() {
    const shareRef = useRef(null);
    const [sharing, setSharing] = useState(false);

    const captureAndShare = useCallback(async () => {
        if (!shareRef.current?.capture) {
            Alert.alert('Error', 'Certificate renderer is not ready.');
            return;
        }
        setSharing(true);
        try {
            // Use 'tmpfile' so the physical image is saved to disk
            const uri = await shareRef.current.capture({ format: 'png', result: 'tmpfile' });
            await RNShare.open({
                url: `file://${uri}`,
                type: 'image/png',
                title: 'Clash of Imaan — Monthly Challenge Certificate',
                message: '🏆 I completed the Clash of Imaan Monthly Challenge! Check out my certificate and join the app. 💪',
            });
        } catch (e) {
            if (e?.message !== 'User did not share') {
                if (__DEV__) console.warn('Certificate share failed:', e);
            }
        } finally {
            setSharing(false);
        }
    }, []);

    return { shareRef, sharing, captureAndShare };
}
