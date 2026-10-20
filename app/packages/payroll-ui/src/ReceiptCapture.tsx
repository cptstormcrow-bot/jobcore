/**
 * ReceiptCapture — presentational receipt photo picker.
 * Camera or library; reports the local asset URI (or null) via onChange.
 * The parent gates Submit on uri being non-null.
 */
import React, { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card, PayrollButton, Text } from '@jobcore/ui';

export interface ReceiptCaptureProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
  disabled?: boolean;
}

export function ReceiptCapture({ uri, onChange, disabled }: ReceiptCaptureProps) {
  const [message, setMessage] = useState<string | null>(null);

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      setMessage(null);
      try {
        const perm =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setMessage(
            source === 'camera'
              ? 'Camera permission was denied. Allow camera access in Settings to take a photo.'
              : 'Photo library permission was denied. Allow photo access in Settings to choose a photo.',
          );
          return;
        }
        const opts: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          quality: 0.7,
        };
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(opts)
            : await ImagePicker.launchImageLibraryAsync(opts);
        if (result.canceled) return;
        const asset = result.assets && result.assets[0];
        if (asset && asset.uri) onChange(asset.uri);
      } catch {
        setMessage('Could not open the picker. Please try again.');
      }
    },
    [onChange],
  );

  return (
    <Card>
      <Text>Receipt photo</Text>
      {uri ? (
        <View style={{ marginVertical: 8, alignItems: 'flex-start' }}>
          <Image
            source={{ uri }}
            style={{ width: 120, height: 120, borderRadius: 8 }}
            resizeMode="cover"
          />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <PayrollButton
          label="Take photo"
          onPress={() => void pick('camera')}
          disabled={disabled}
        />
        <PayrollButton
          label="Choose from library"
          onPress={() => void pick('library')}
          disabled={disabled}
        />
        {uri ? (
          <PayrollButton label="Remove" onPress={() => onChange(null)} disabled={disabled} />
        ) : null}
      </View>
      {message ? <Text>{message}</Text> : null}
    </Card>
  );
}
