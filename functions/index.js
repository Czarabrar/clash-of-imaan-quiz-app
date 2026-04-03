/**
 * Clash of Imaan — Cloud Functions
 *
 * onChallengeCreated: When a new challenge document is created,
 * sends a push notification to the opponent via FCM.
 *
 * Runs on Firebase Spark (free) plan — no external network calls.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

/**
 * Triggered when a new challenge doc is created.
 * Sends a push notification to the opponent.
 */
exports.onChallengeCreated = onDocumentCreated('challenges/{challengeId}', async (event) => {
    const challenge = event.data.data();
    const challengeId = event.params.challengeId;

    const { opponentId, challengerId } = challenge;
    if (!opponentId || !challengerId) return null;

    const db = getFirestore();

    // Fetch both users in parallel
    const [opponentSnap, challengerSnap] = await Promise.all([
        db.collection('users').doc(opponentId).get(),
        db.collection('users').doc(challengerId).get(),
    ]);

    if (!opponentSnap.exists) {
        return null;
    }

    const opponentData = opponentSnap.data();
    const challengerData = challengerSnap.data();
    const fcmToken = opponentData.fcmToken;

    if (!fcmToken) {
        return null;
    }

    const challengerName = challengerData?.name || 'Someone';

    const message = {
        token: fcmToken,
        notification: {
            title: '⚔️ You\'ve been challenged!',
            body: `${challengerName} has challenged you to a duel! Open the Arena to accept.`,
        },
        data: {
            type: 'challenge',
            challengeId,
            screen: 'Arena',
        },
        android: {
            notification: {
                channelId: 'clash_challenges',
                priority: 'high',
                sound: 'default',
            },
        },
    };

    try {
        const response = await getMessaging().send(message);
    } catch (err) {
        console.error(`FCM failed for ${opponentId}:`, err);
    }

    return null;
});
