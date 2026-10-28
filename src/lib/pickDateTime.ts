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
    onChange: (e, date) => {
      if (e.type !== 'set' || !date) return;
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        onChange: (e2, time) => {
          if (e2.type === 'set' && time) onChange(time);
        },
      });
    },
  });
}
