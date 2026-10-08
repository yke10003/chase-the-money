import { Platform, type TextStyle } from 'react-native';

export type Scheme = 'dark' | 'light';

export type Palette = {
  paper: string;
  surface: string;
  sunken: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  onInk: string;
  money: string;
  moneySoft: string;
  moneyInk: string;
  xp: string;
  xpOn: string;
  xpSoft: string;
  overdue: string;
  overdueSoft: string;
  due: string;
  dueSoft: string;
  danger: string;
  dangerSoft: string;
  scrim: string;
  heroInk: string;
};

export type MissionType = 'earn' | 'sell' | 'recover' | 'save';

export type TypeTint = { base: string; soft: string; ink: string };
export type Accent = { from: string; to: string; mid: string; on: string };

const dark: Palette = {
  paper: '#07080B',
  surface: '#14171F',
  sunken: '#222632',
  ink: '#F4F1EA',
  ink2: '#C2BDB4',
  ink3: '#8E887F',
  line: '#2A2E38',
  lineStrong: '#3E4452',
  onInk: '#12110F',
  money: '#3DDC97',
  moneySoft: '#10281C',
  moneyInk: '#B8F6D4',
  xp: '#F0C14B',
  xpOn: '#1A1404',
  xpSoft: '#2A230E',
  overdue: '#FF6B5A',
  overdueSoft: '#3A1814',
  due: '#F5B042',
  dueSoft: '#3A2A10',
  danger: '#FF7A70',
  dangerSoft: '#3A1816',
  scrim: 'rgba(0,0,0,0.62)',
  heroInk: '#140C08',
};

const light: Palette = {
  paper: '#FFFFFF',
  surface: '#F4F5F7',
  sunken: '#E8EAEE',
  ink: '#1C1B19',
  ink2: '#5C616A',
  ink3: '#7A808A',
  line: '#E4E6EA',
  lineStrong: '#D0D4DA',
  onInk: '#FFFFFF',
  money: '#0C7A45',
  moneySoft: '#E5F6EC',
  moneyInk: '#0C7A45',
  xp: '#E2B230',
  xpOn: '#1A1404',
  xpSoft: '#F8EFCF',
  overdue: '#C2412D',
  overdueSoft: '#F8E4DE',
  due: '#9A5B00',
  dueSoft: '#F8EBD4',
  danger: '#B42318',
  dangerSoft: '#F8E4E1',
  scrim: 'rgba(28,27,25,0.4)',
  heroInk: '#140C08',
};

export const palettes: Record<Scheme, Palette> = { dark, light };

export const typeColor: Record<Scheme, Record<MissionType, TypeTint>> = {
  dark: {
    earn: { base: '#8B9BFF', soft: '#1A1F3D', ink: '#D5DCFF' },
    sell: { base: '#F0A05A', soft: '#3A2412', ink: '#FFD7B0' },
    recover: { base: '#3DCFC8', soft: '#0E2C2A', ink: '#C6F7F3' },
    save: { base: '#C084FC', soft: '#2A1840', ink: '#E9D4FF' },
  },
  light: {
    earn: { base: '#3A4FD8', soft: '#E6E9FA', ink: '#24308F' },
    sell: { base: '#C45E1A', soft: '#F8E7D8', ink: '#8A3E0C' },
    recover: { base: '#0F766E', soft: '#D9F3F0', ink: '#0C554F' },
    save: { base: '#7E22CE', soft: '#F3E8FB', ink: '#5B178F' },
  },
};

/** Hero fills. `mid` is the third stop used by the wash. */
export const accent: Record<Scheme, Record<MissionType | 'build', Accent>> = {
  dark: {
    earn: { from: '#2C3DAB', to: '#1A2678', mid: '#6E86F5', on: '#F4F6FF' },
    sell: { from: '#C4621C', to: '#8A3C10', mid: '#F0A45A', on: '#FFF8F2' },
    recover: { from: '#0E7A72', to: '#0A524C', mid: '#3DCFC4', on: '#F3FFFD' },
    save: { from: '#7C3AED', to: '#4C1D95', mid: '#C4B5FD', on: '#FBF7FF' },
    build: { from: '#6D28D9', to: '#4C1D95', mid: '#A78BFA', on: '#F7F3FF' },
  },
  light: {
    earn: { from: '#3D52C9', to: '#2436A0', mid: '#8AA0FF', on: '#F7F8FF' },
    sell: { from: '#D06A22', to: '#9A4512', mid: '#F2B06A', on: '#FFF9F3' },
    recover: { from: '#12867C', to: '#0C5C56', mid: '#5ED9CE', on: '#F4FFFD' },
    save: { from: '#8B5CF6', to: '#5B21B6', mid: '#DDD6FE', on: '#FCFAFF' },
    build: { from: '#7C3AED', to: '#5B21B6', mid: '#C4B5FD', on: '#F8F5FF' },
  },
};

export const uiFont = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Segoe UI", system-ui, sans-serif',
  ios: 'System',
  default: 'sans-serif',
}) as string;

export const font = {
  display: uiFont,
  displayHeavy: uiFont,
  displaySemi: uiFont,
  body: uiFont,
  medium: uiFont,
  semi: uiFont,
  bold: uiFont,
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Color is applied by the theme, not baked in here. */
export const type = {
  hero: { fontFamily: uiFont, fontWeight: weight.bold, fontSize: 56, lineHeight: 60, letterSpacing: -1.15, ...tabular },
  display: { fontFamily: uiFont, fontWeight: weight.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.7, ...tabular },
  title: { fontFamily: uiFont, fontWeight: weight.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.45 },
  heading: { fontFamily: uiFont, fontWeight: weight.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.25 },
  subheading: { fontFamily: uiFont, fontWeight: weight.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: uiFont, fontWeight: weight.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: uiFont, fontWeight: weight.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: uiFont, fontWeight: weight.medium, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: uiFont, fontWeight: weight.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  figure: { fontFamily: uiFont, fontWeight: weight.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3, ...tabular },
} satisfies Record<string, TextStyle>;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  hero: 22,
  pill: 999,
} as const;

export const breakpoint = {
  phone: 0,
  tablet: 760,
  desktop: 1024,
  wide: 1240,
} as const;

export const contentMaxWidth = 1360;
