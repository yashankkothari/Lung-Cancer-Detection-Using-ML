/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  // Base colors
  background: '#000000',
  surface: '#0A0A0A',
  card: '#141414',
  
  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#999999',
    muted: '#666666',
  },
  
  // Accent colors (from the Ghost Hand Kit)
  accent: {
    blue: '#00E5FF',    // Cyan neon
    purple: '#B14EFF',  // Purple neon
    pink: '#FF1F71',    // Pink neon
    green: '#00FF94',   // Green neon
    orange: '#FF8A00',  // Orange neon
  },
  
  // Border colors
  border: {
    default: '#333333',
    active: '#00E5FF',  // Using the cyan neon as active state
  },
  
  // Status colors
  status: {
    success: '#00FF94',  // Green neon
    warning: '#FF8A00',  // Orange neon
    error: '#FF1F71',    // Pink neon
    info: '#00E5FF',     // Cyan neon
  },
  
  // Gradient colors
  gradient: {
    start: '#000000',
    middle: '#0A0A0A',
    end: '#141414',
  },
  
  // Overlay colors
  overlay: {
    light: 'rgba(255, 255, 255, 0.1)',
    dark: 'rgba(0, 0, 0, 0.7)',
  }
};

export type ColorsType = typeof Colors;
