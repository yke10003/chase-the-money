import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BloomPreview } from '../../bloom-preview';

export default function InAppBloom() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.dismissTo('/');
    }
  }, [router]);

  if (!__DEV__) {
    return null;
  }

  return <BloomPreview />;
}
