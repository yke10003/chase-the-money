import { Host, Button as SwiftButton, Image as SwiftImage, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, frame } from '@expo/ui/swift-ui/modifiers';

import type { SellPhoto } from '@/api/types';
import { savePictures } from '@/lib/photo-download';
import { useTheme } from '@/state/theme';

export function PhotoDownloadMenu({
  photos,
  index,
  itemName,
  itemId,
}: {
  photos: SellPhoto[];
  index: number;
  itemName: string;
  itemId: number;
}) {
  const { color } = useTheme();

  return (
    <Host matchContents>
      <Menu
        label={(
          <SwiftButton modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel('Download pictures')]}>
            <SwiftImage systemName="square.and.arrow.down" size={15} color={color.ink} />
          </SwiftButton>
        )}
      >
        <SwiftButton label="This picture" systemImage="photo" onPress={() => savePictures(photos, index, false, itemName, itemId)} />
        <SwiftButton label="All pictures" systemImage="photo.on.rectangle" onPress={() => savePictures(photos, index, true, itemName, itemId)} />
      </Menu>
    </Host>
  );
}
