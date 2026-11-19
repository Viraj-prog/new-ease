import SegmentedToggle from '@/components/SegmentedToggle';
import { useTheme } from '@/lib/theme';

// Moon / sun switch that sits above the home sheet.
export default function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <SegmentedToggle
      compact
      options={[
        { key: 'dark', icon: 'moon' },
        { key: 'light', icon: 'sun' },
      ]}
      value={mode}
      onChange={setMode}
    />
  );
}
