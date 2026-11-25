export type Avatar = { bg: string; fg: string };

export const lightColors = {
  // surfaces
  background: '#EDF1F3',   // screen background and input fields
  surface: '#FFFFFF',      // sheets, drawers, cards, dialogs
  card: '#FFFFFF',
  input: '#EDF1F3',
  pill: '#E6ECF0',         // grey user pill and date pill
  homeSheet: '#F7FAFD',    // rider home bottom sheet
  recentCircle: '#E2EAF2', // circle behind recent-trip icons
  selected: '#DCEBFF',     // selected menu item, saved-trip circles

  // text
  text: '#10171B',
  textSecondary: '#5B6870',
  placeholder: '#4A5760',
  onTint: '#0B63C4',       // blue text and icons on tinted areas

  // lines
  border: '#D3DADF',
  borderMid: '#D3DADF',
  borderStrong: '#D3DADF',
  handle: '#C2CBD1',       // sheet handle and outlined button borders
  homeSheetBorder: '#D2DBE6', // thin outline along the home sheet's top edge
  pillShadow: 'rgba(16,23,27,0.22)', // soft shadow under the search pill

  // action colours
  brand: '#1E90FF',
  onBrand: '#04101A',
  toggleActiveText: '#FFFFFF', // text on the toggle's blue side (light menus)
  onPreview: '#FFFFFF',        // text on the "Preview route" button
  success: '#34D399',
  onSuccess: '#04140D',
  successTint: '#D8F3E8',  // soft green badge background
  onSuccessTint: '#0F7A55',
  alert: '#FF6B6B',
  onAlert: '#1A0708',
  alertText: '#D63A3A',    // red text such as Log Out
  alertTint: '#FBDADA',    // soft red badge background, such as a cancelled trip
  ring: '#FFFFFF',         // outline around map dots
  star: '#FFC857',
  pickup: '#8B6CD6',
  dropoff: '#10171B',      // not specified for light; uses the main text colour

  // overlays
  scrim: 'rgba(16,23,27,0.45)',
  statBg: '#E3E8EB',       // light grey distance / time tag
  onStat: '#10171B',
  statLabel: 'rgba(16,23,27,0.6)',
  shadow: 'rgba(16,23,27,0.18)',

  avatars: [
    { bg: '#EADFFB', fg: '#5B3BB0' }, // purple
    { bg: '#D8F3E8', fg: '#0F7A55' }, // green
    { bg: '#FBEFCF', fg: '#8A5A00' }, // gold
    { bg: '#FBDADA', fg: '#B03030' }, // red
    { bg: '#DCEBFF', fg: '#0B63C4' }, // blue
  ] as Avatar[],
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  background: '#0E1113',
  surface: '#161B1F',
  card: '#1D2328',
  input: '#12161A',
  pill: '#252C32',
  homeSheet: '#161B1F',
  recentCircle: '#16283D',
  selected: '#12263F',

  text: '#F1F5F3',
  textSecondary: '#98A49E',
  placeholder: '#B4BEB9',
  onTint: '#6DB8FF',

  border: '#262D33',
  borderMid: '#2A3238',
  borderStrong: '#2F383E',
  handle: '#3A434A',
  homeSheetBorder: '#262D33',
  pillShadow: 'rgba(0,0,0,0.65)',

  brand: '#1E90FF',
  onBrand: '#04101A',
  toggleActiveText: '#04101A',
  onPreview: '#04101A',
  success: '#34D399',
  onSuccess: '#04140D',
  successTint: '#10261D',
  onSuccessTint: '#6EE7B7',
  alert: '#FF6B6B',
  onAlert: '#1A0708',
  alertText: '#FF6B6B',
  alertTint: '#2B1618',
  ring: '#F1F5F3',
  star: '#FFC857',
  pickup: '#8B6CD6',
  dropoff: '#F1F5F3',

  statBg: '#2A3138',       // lighter than the dark sheet so the tag still shows
  onStat: '#FFFFFF',
  statLabel: 'rgba(255,255,255,0.7)',
  scrim: 'rgba(0,0,0,0.6)',   // not specified for dark: my choice
  shadow: 'rgba(0,0,0,0.4)',  // not specified for dark: my choice

  avatars: [
    { bg: '#2A2433', fg: '#D9C8F5' },
    { bg: '#10261D', fg: '#6EE7B7' },
    { bg: '#2B2314', fg: '#FFC857' },
    { bg: '#2B1618', fg: '#FF9A9A' },
    { bg: '#12263F', fg: '#6DB8FF' },
  ] as Avatar[],
};

// Used in step 1b to build the dark and light map styles.
export const lightMap = {
  park: '#D9E9DA',
  river: '#BCDCF0',
  roadMinor: '#E1E6E9',
  roadMid: '#D6DDE1',
  roadMajor: '#C8D0D5',
  routeOriginal: '#9AA6AE', // the dashed original route
};

export const darkMap: typeof lightMap = {
  park: '#0F1C17',
  river: '#0F2230',
  roadMinor: '#171D21',
  roadMid: '#1D252A',
  roadMajor: '#252E34',
  routeOriginal: '#5B666E',
};