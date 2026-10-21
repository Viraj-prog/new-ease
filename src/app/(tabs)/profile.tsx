import InteractiveMap from '@/components/map';
import { colors } from '@/styles/global';
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


export default function ProfileScreen() {

  const bottomSheetRef = useRef<BottomSheet>(null);

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  const snapPoints = useMemo(() => ['25%', '90%'], []);
  const [destinationAddress, setDestinationAddress] = useState('');

   useEffect(() => {
    const requestLocationPermission = async () => {
      
      // Permissions are handled automatically by iOS via Info.plist, 
      // but Android requires explicit code execution.
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs access to your location to center the map.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
        } catch (err) {
          console.warn(err);
        }
      }
    };
    requestLocationPermission();
  }, []);



  return (
    <GestureHandlerRootView style={styles.container}>
      <InteractiveMap />
      <BottomSheet
        ref={bottomSheetRef}
        onChange={handleSheetChanges}
        index={0} //changes the initial position of the bottom sheet to the second snap point (50% of the screen height)
        snapPoints={snapPoints} // Defines the snap points for the bottom sheet
        keyboardBehavior="extend" // Ensures the bottom sheet adjusts when the keyboard appears
        enableDynamicSizing={false} // Disables dynamic sizing of the bottom sheet based on its content
        backgroundStyle={{
          backgroundColor: 'rgba(255, 255, 255,0.9)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4, 
          shadowRadius: 10, 
          elevation: 12   }} // Sets a semi-transparent white background for the bottom sheet
        
        
        style={styles.sheetContainer} // Adds a subtle shadow effect to the bottom sheet
      >
        <BottomSheetTextInput 
        style={styles.input}
        placeholder='Where to?'
        placeholderTextColor={colors.textSecondary}
        value={destinationAddress}
        onChangeText={setDestinationAddress} 
        />
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Fills 100% of the screen height and width
    
  },
  map: {
    flex: 1, // Fills 100% of the container view
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  sheetContainer:{
    marginHorizontal: 5,
    borderRadius: 24,
    
  },
  input: {
    backgroundColor: '#f0f0f0',
    color: colors.text,
    padding: 20,
    borderRadius: 10,
    fontSize: 16,
    marginTop: 20,
    marginHorizontal: 20,
    lineHeight: 30,

  },
  
});
