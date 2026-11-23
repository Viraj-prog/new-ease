import { Image } from 'expo-image';

// The designer's icon set. The PNGs are white, so `color` recolours them for any theme.
// Metro needs literal require() paths, so every icon is listed here.
const sources = {
  'arrow-left': require('../../assets/images/icons/arrow-left.png'),
  'at-sign': require('../../assets/images/icons/at-sign.png'),
  'billing-card': require('../../assets/images/icons/billing-card.png'),
  calendar: require('../../assets/images/icons/calendar.png'),
  'check-circle': require('../../assets/images/icons/check-circle.png'),
  'chevron-right': require('../../assets/images/icons/chevron-right.png'),
  clock: require('../../assets/images/icons/clock.png'),
  close: require('../../assets/images/icons/close.png'),
  home: require('../../assets/images/icons/home.png'),
  'locate-pin': require('../../assets/images/icons/locate-pin.png'),
  'log-out': require('../../assets/images/icons/log-out.png'),
  'map-pin': require('../../assets/images/icons/map-pin.png'),
  menu: require('../../assets/images/icons/menu.png'),
  moon: require('../../assets/images/icons/moon.png'),
  plus: require('../../assets/images/icons/plus.png'),
  profile: require('../../assets/images/icons/profile.png'),
  rider: require('../../assets/images/icons/rider.png'),
  'saved-bookmark': require('../../assets/images/icons/saved-bookmark.png'),
  school: require('../../assets/images/icons/school.png'),
  star: require('../../assets/images/icons/star.png'),
  'steering-wheel': require('../../assets/images/icons/steering-wheel.png'),
  sun: require('../../assets/images/icons/sun.png'),
  swap: require('../../assets/images/icons/swap.png'),
  'trips-route': require('../../assets/images/icons/trips-route.png'),
  'turn-right': require('../../assets/images/icons/turn-right.png'),
  users: require('../../assets/images/icons/users.png'),
  volume: require('../../assets/images/icons/volume.png'),
  work: require('../../assets/images/icons/work.png'),
} as const;

export type IconName = keyof typeof sources;

export default function Icon({
  name,
  size = 24,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  return (
    <Image
      source={sources[name]}
      style={{ width: size, height: size }}
      tintColor={color}
      contentFit='contain'
    />
  );
}
