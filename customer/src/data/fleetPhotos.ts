import type { ImageSourcePropType } from 'react-native';

/** Fleet photos shipped with the app, chosen by the vehicle's photo key from the server. */
export const FLEET_PHOTOS: Record<string, ImageSourcePropType> = {
  fleet_innova_crysta: require('../../assets/images/fleet_innova_crysta.png'),
  fleet_virtus: require('../../assets/images/fleet_virtus.png'),
  fleet_thar: require('../../assets/images/fleet_thar.png'),
  fleet_swift: require('../../assets/images/fleet_swift.png'),
  fleet_baleno: require('../../assets/images/fleet_baleno.png'),
  fleet_wagonr: require('../../assets/images/fleet_wagonr.png'),
  fleet_creta: require('../../assets/images/fleet_creta.png'),
};
