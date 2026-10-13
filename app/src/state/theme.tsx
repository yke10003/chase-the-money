import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';

import { accent, palettes, type as typeScale, typeColor, type Palette, type Scheme } from '@/design/palette';

export type AppearancePreference = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'sidehustle.appearance';

type ThemeValue = {
  scheme: Scheme;
  preference: AppearancePreference;
  setPreference: (value: AppearancePreference) => void;
  color: Palette;
  typeColor: (typeof typeColor)['dark'];
  accent: (typeof accent)['dark'];
  type: ReturnType<typeof coloredType>;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function readPreference(): AppearancePreference {
  if (typeof localStorage === 'undefined') {
    return 'system';
  }

  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
}

function coloredType(color: Palette) {
  return {
    hero: { ...typeScale.hero, color: color.ink } as TextStyle,
    display: { ...typeScale.display, color: color.ink } as TextStyle,
    title: { ...typeScale.title, color: color.ink } as TextStyle,
    heading: { ...typeScale.heading, color: color.ink } as TextStyle,
    subheading: { ...typeScale.subheading, color: color.ink } as TextStyle,
    body: { ...typeScale.body, color: color.ink } as TextStyle,
    bodyStrong: { ...typeScale.bodyStrong, color: color.ink } as TextStyle,
    small: { ...typeScale.small, color: color.ink2 } as TextStyle,
    eyebrow: { ...typeScale.eyebrow, color: color.ink3 } as TextStyle,
    figure: { ...typeScale.figure, color: color.ink } as TextStyle,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const os = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');

  useEffect(() => {
    setPreferenceState(readPreference());
  }, []);

  function setPreference(value: AppearancePreference) {
    setPreferenceState(value);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }

  const scheme: Scheme = preference === 'system' ? (os === 'light' ? 'light' : 'dark') : preference;
  const color = palettes[scheme];

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      color,
      typeColor: typeColor[scheme],
      accent: accent[scheme],
      type: coloredType(color),
    }),
    [scheme, preference, color],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return value;
}

export function cardShadow(scheme: Scheme): TextStyle {
  if (scheme !== 'light') {
    return {};
  }

  return { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' } as TextStyle;
}
