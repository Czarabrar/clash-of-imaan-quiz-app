/**
 * Clash of Imaan — Ramadan cream, green, and gold design system.
 */

export const COLORS = {
    background: '#F7F0E3',
    backgroundAlt: '#FFF9F0',
    primaryGold: '#C9A227',
    secondaryGold: '#E3C66F',
    goldLight: '#F6E7B2',
    goldDark: '#8B7314',
    darkBrown: '#2E2418',
    lightBrown: '#8B7A63',
    cardBackground: '#FFF8EF',
    cream: '#FFF7EA',
    creamBorder: '#E8D8B0',
    softGreen: '#DDE9D4',
    sage: '#BFD4B2',
    mint: '#E9F4E1',
    pastelBlue: '#E5EEF9',
    pastelPeach: '#FBE9D7',
    lanternPurple: '#241241',
    lanternPurpleSoft: '#3C245E',
    moonGlow: '#FFEAB5',
    white: '#FFFFFF',
    shadow: 'rgba(46, 36, 24, 0.10)',
    overlay: 'rgba(26, 15, 47, 0.48)',
    success: '#4E8A5C',
    error: '#B14B4B',
    info: '#5179B5',
    beigeDark: '#EADFCB',
    transparent: 'transparent',
};

export const GRADIENTS = {
    ramadanNight: ['#180B34', '#2B1552', '#3A1E62'],
    creamGlow: ['#FFF9EF', '#F6EBD7'],
    greenCard: ['#EAF4E3', '#DCEBD0'],
    goldAccent: ['#E4C977', '#BF9325'],
};

export const TYPOGRAPHY = {
    heading: {
        fontFamily: 'serif',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    body: {
        fontFamily: 'serif',
        fontWeight: '400',
        letterSpacing: 0.3,
    },
    caption: {
        fontFamily: 'serif',
        fontWeight: '400',
        letterSpacing: 0.2,
    },
};

export const FONT_SIZES = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    hero: 28,
    display: 36,
    clock: 48,
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const BORDER_RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 32,
    circle: 999,
};

export const SHADOWS = {
    card: {
        shadowColor: COLORS.darkBrown,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    elevated: {
        shadowColor: COLORS.darkBrown,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    navigation: {
        shadowColor: COLORS.darkBrown,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
    },
};
