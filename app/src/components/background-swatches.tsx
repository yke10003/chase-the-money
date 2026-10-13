import { Pressable, View } from 'react-native';

export const PHOTO_BACKGROUNDS = [
  '#FFFFFF',
  '#000000',
  '#E6E4E1',
  '#D7E4DA',
  '#D5E1EB',
  '#F0D9D6',
  '#2C2C2C',
  '#343C44',
  '#3C4741',
  '#453E48',
];

export function BackgroundSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {PHOTO_BACKGROUNDS.map((hex) => {
        const selected = value.toLowerCase() === hex.toLowerCase();

        return (
          <Pressable
            key={hex}
            accessibilityRole="button"
            accessibilityLabel={hex}
            accessibilityState={{ selected }}
            onPress={() => onChange(hex)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: hex,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? '#1A1A1A' : 'rgba(0,0,0,0.18)',
            }}
          />
        );
      })}
    </View>
  );
}
