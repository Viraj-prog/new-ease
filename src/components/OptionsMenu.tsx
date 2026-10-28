import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type MenuItem = {
  key: string;
  label: string;
  // Current value shown after the label, e.g. "2 km".
  detail?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

// Where the round button that opened the menu sits on screen.
export type Anchor = { x: number; y: number; w: number; h: number };

type Props = {
  visible: boolean;
  anchor: Anchor | null;
  items: MenuItem[];
  onClose: () => void;
};

const ITEM_HEIGHT = 44;
const GAP = 12;

// Labeled pills that stack up from the round button over a faded screen (like Google
// Calendar's "+" menu). The button turns into an X while the menu is open.
export default function OptionsMenu({ visible, anchor, items, onClose }: Props) {
  if (!anchor) return null;

  const stackHeight = items.length * ITEM_HEIGHT + (items.length - 1) * GAP;
  const stackTop = anchor.y - GAP - stackHeight;

  function choose(item: MenuItem) {
    onClose();
    // Let this popup finish closing before another dialog opens on top of the screen.
    setTimeout(item.onPress, 250);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Spans from the screen's left edge to the button's right edge, so the pills line up with it. */}
      <View style={[styles.stack, { top: stackTop, width: anchor.x + anchor.w }]} pointerEvents='box-none'>
        {items.map((item) => (
          <Pressable key={item.key} style={styles.pill} onPress={() => choose(item)}>
            <Ionicons name={item.icon} size={20} color={colors.brand} />
            <Text style={styles.label}>
              {item.label}
              {item.detail ? <Text style={styles.detail}>{`  ·  ${item.detail}`}</Text> : null}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onClose}
        style={[styles.close, { left: anchor.x, top: anchor.y, width: anchor.w, height: anchor.h, borderRadius: anchor.h / 2 }]}
      >
        <Ionicons name='close' size={22} color='#000' />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.8)' },
  stack: { position: 'absolute', left: 0, alignItems: 'flex-end', gap: GAP },
  pill: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderRadius: ITEM_HEIGHT / 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  detail: { fontWeight: '400', color: '#6b6b6b' },
  close: {
    position: 'absolute',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
});
