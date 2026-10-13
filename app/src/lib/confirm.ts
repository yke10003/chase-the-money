import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, labels: { cancel: string; confirm: string } = { cancel: 'Cancel', confirm: 'Continue' }): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: labels.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: labels.confirm, onPress: () => resolve(true) },
    ]);
  });
}
