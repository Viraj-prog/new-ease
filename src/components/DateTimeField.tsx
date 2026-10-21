import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

type Props = { value: Date; onChange: (d: Date) => void };

// Android only: opens the date picker, then the time picker.
export default function DateTimeField({ value, onChange }: Props) {
  function open() {
    if (Platform.OS !== "android") return;
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      onChange: (e, date) => {
        if (e.type !== "set" || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          onChange: (e2, time) => {
            if (e2.type === "set" && time) onChange(time);
          },
        });
      },
    });
  }

  return (
    <Pressable style={styles.field} onPress={open}>
      <Text>{value.toLocaleString()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
});
