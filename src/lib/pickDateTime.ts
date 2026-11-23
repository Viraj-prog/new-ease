import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Alert, Platform } from 'react-native';

// Opens the date picker, then the time picker. Android only for now.
export function pickDateTime(value: Date, onChange: (d: Date) => void) {
  if (Platform.OS !== 'android') {
    Alert.alert('Not available yet', 'The date and time picker only works on Android for now.');
    return;
  }
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    onValueChange: (_e, date) => {
      if (!date) return;
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        onValueChange: (_e2, time) => {
          if (time) onChange(time);
        },
      });
    },
  });
}

function openOne(mode: 'date' | 'time', value: Date, onChange: (d: Date) => void) {
  if (Platform.OS !== 'android') {
    Alert.alert('Not available yet', 'The date and time picker only works on Android for now.');
    return;
  }
  DateTimePickerAndroid.open({
    value,
    mode,
    onValueChange: (_e, picked) => {
      if (!picked) return;
      const d = new Date(value);
      if (mode === 'date') d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      else d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      onChange(d);
    },
  });
}

// Change only the day, keeping the time.
export const pickDate = (value: Date, onChange: (d: Date) => void) => openOne('date', value, onChange);
// Change only the time, keeping the day.
export const pickTime = (value: Date, onChange: (d: Date) => void) => openOne('time', value, onChange);
