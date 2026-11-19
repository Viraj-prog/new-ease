import { secureStorage } from '@/lib/secureStorage';
import { darkColors, lightColors, type Colors } from '@/styles/theme';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

type Mode = 'light' | 'dark';
type Theme = {
  mode: Mode;
  // The mode the map is drawn in. It follows `mode` once the colour fade has finished.
  mapMode: Mode;
  colors: Colors;
  setMode: (m: Mode) => void;
};

const KEY = 'theme.mode';
const ThemeContext = createContext<Theme | null>(null);

// How long the light <-> dark colour change takes.
const FADE_MS = 450;

type RGBA = [number, number, number, number];

function parse(c: string): RGBA | null {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16),
      1,
    ];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b, a];
}

// A colour part of the way from a to b (t = 0 is a, t = 1 is b).
function mix(a: string, b: string, t: number): string {
  // Equal colours keep their exact text, so nothing downstream sees a change.
  if (a === b) return a;
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return t < 0.5 ? a : b;
  const [r, g, bl, al] = x.map((v, i) => v + (y[i] - v) * t);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(bl)},${+al.toFixed(3)})`;
}

// The whole palette part of the way from light (0) to dark (1).
function blend(t: number): Colors {
  if (t <= 0) return lightColors;
  if (t >= 1) return darkColors;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(lightColors) as (keyof Colors)[]) {
    if (k === 'avatars') continue;
    out[k] = mix(lightColors[k] as string, darkColors[k] as string, t);
  }
  out.avatars = lightColors.avatars.map((a, i) => ({
    bg: mix(a.bg, darkColors.avatars[i].bg, t),
    fg: mix(a.fg, darkColors.avatars[i].fg, t),
  }));
  return out as Colors;
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [saved, setSaved] = useState<Mode | null>(null);

  // No saved choice yet: follow the phone's setting.
  const mode: Mode = saved ?? (system === 'light' ? 'light' : 'dark');

  // How dark the colours are right now: 0 = light palette, 1 = dark palette.
  const [dark, setDark] = useState(mode === 'dark' ? 1 : 0);
  const darkRef = useRef(dark);
  const frame = useRef<number | null>(null);

  function stop() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  // Set the colours straight away, with no animation (startup, phone setting changes).
  function jumpTo(v: number) {
    stop();
    darkRef.current = v;
    setDark(v);
  }

  // The map can't fade: its style reloads in one go, and that work would stall the colour
  // fade. So the map switches to the new style only once the fade is finished.
  const [mapModeState, setMapModeState] = useState<Mode>(mode);

  // Slide the colours to the other palette, a little each frame.
  function fadeTo(to: number, from: number) {
    stop();
    if (from === to) return;
    const start = Date.now();
    const duration = FADE_MS * Math.abs(to - from);
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const v = from + (to - from) * easeInOut(k);
      darkRef.current = v;
      setDark(v);
      if (k < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        frame.current = null;
        setMapModeState(to === 1 ? 'dark' : 'light');
      }
    };
    frame.current = requestAnimationFrame(step);
  }

  // Load the user's saved choice once.
  useEffect(() => {
    secureStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark') {
        setSaved(v);
        setMapModeState(v);
        jumpTo(v === 'dark' ? 1 : 0);
      }
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // With no saved choice, the colours simply follow the phone's light/dark setting.
  const shown = saved === null ? (system === 'light' ? 0 : 1) : dark;
  const mapMode: Mode = saved === null ? mode : mapModeState;

  function setMode(m: Mode) {
    if (m === mode) return;
    setSaved(m);
    secureStorage.setItem(KEY, m);
    fadeTo(m === 'dark' ? 1 : 0, shown);
  }

  const colors = useMemo(() => blend(shown), [shown]);

  return (
    <ThemeContext.Provider value={{ mode, mapMode, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
