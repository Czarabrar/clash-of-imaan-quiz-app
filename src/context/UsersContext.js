import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const UsersContext = createContext(null);
const USERS_CACHE_KEY = 'users_context_cache';

export function UsersProvider({ children }) {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const fetchUsers = useCallback(async () => {
        if (!user) return;
        setLoadingUsers(true);
        try {
            const snapshot = await firestore()
                .collection('users')
                .orderBy('totalOverallPoints', 'desc')
                .limit(100)
                .get();

            const fetchedUsers = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || 'User',
                    totalPoints: data.totalOverallPoints || 0,
                    score: 0, // Today score logic placeholder
                    streak: data.currentStreak || 0,
                    avatar: (data.name || 'U').charAt(0).toUpperCase(),
                    role: data.role || 'user',
                    matchesPlayed: data.matchesPlayed || 0,
                    challengesWon: data.challengesWon || 0,
                    isOnline: data.isOnline === true,
                    lastActive: data.lastActive || null,
                };
            });
            setUsers(fetchedUsers);
            await AsyncStorage.setItem(USERS_CACHE_KEY, JSON.stringify(fetchedUsers));
        } catch (error) {
            if (__DEV__) console.error('UsersContext: Failed to fetch users', error);
        } finally {
            setLoadingUsers(false);
        }
    }, [user]);

    // Initial fetch when auth user is available
    useEffect(() => {
        if (user) {
            AsyncStorage.getItem(USERS_CACHE_KEY)
                .then(cached => {
                    if (cached) {
                        setUsers(JSON.parse(cached));
                    }
                })
                .catch(() => {});
            fetchUsers();
        } else {
            setUsers([]);
            setLoadingUsers(true);
        }
    }, [user, fetchUsers]);

    return (
        <UsersContext.Provider value={{ users, loadingUsers, refreshUsers: fetchUsers }}>
            {children}
        </UsersContext.Provider>
    );
}

export function useUsersContext() {
    const context = useContext(UsersContext);
    if (!context) {
        throw new Error('useUsersContext must be used within a UsersProvider');
    }
    return context;
}

// Alias for components that import useUsers
export const useUsers = useUsersContext;
