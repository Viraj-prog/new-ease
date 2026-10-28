import { colors } from '@/styles/global';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  hint: string;
  value: number;
  unit: string;
  onSave: (n: number) => void;
  onClose: () => void;
};

// Small popup with one number field, used for the driver settings.
export default function NumberPopup({ visible, title, hint, value, unit, onSave, onClose }: Props) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState('');

  function save() {
    const n = parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      setError('Enter a number of 0 or more.');
      return;
    }
    setError('');
    onSave(n);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={onClose}
      onShow={() => setText(String(value))}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner pressable stops taps on the card from closing the popup. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(t) => {
                setText(t);
                setError('');
              }}
              keyboardType='decimal-pad'
              autoFocus
              selectTextOnFocus
            />
            <Text style={styles.unit}>{unit}</Text>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <Pressable style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={save}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: '#555' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    color: colors.text,
  },
  unit: { fontSize: 16, color: colors.text },
  error: { color: colors.alert, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  button: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancel: { backgroundColor: '#e5e5e5' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
