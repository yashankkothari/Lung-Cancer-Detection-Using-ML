/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  primary: '#6C2BD9',
  secondary: '#FF4B81',
  background: {
    dark: '#1A1B25',
    gradient: ['#1A1B25', '#2B1055']
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B4B4C7',
    accent: '#FF4B81'
  },
  button: {
    primary: '#FF4B81',
    secondary: 'rgba(255, 255, 255, 0.1)'
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)'
  }
} as const;

export type ColorsType = typeof Colors;
