import { Image, StyleSheet, View } from 'react-native';

export function ListingPhoto({ uri, label, aspectRatio, backgroundColor = '#FFFFFF', contain = false }: { uri: string; label: string; aspectRatio: number; backgroundColor?: string; contain?: boolean }) {
  const cutout = contain || uri.includes('.png') || uri.includes('background-removal');

  return (
    <View style={{ width: '100%', aspectRatio, borderRadius: 20, overflow: 'hidden', backgroundColor }}>
      <Image source={{ uri }} accessibilityLabel={label} resizeMode={cutout ? 'contain' : 'cover'} style={StyleSheet.absoluteFill} />
    </View>
  );
}
