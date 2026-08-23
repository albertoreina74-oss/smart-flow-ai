import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  base64: string;
  mimeType: string;
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.6,
  allowsEditing: false,
};

function toPickedImage(result: ImagePicker.ImagePickerResult): PickedImage | null {
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  if (!asset.base64) {
    throw new Error('Impossibile leggere i dati dell\'immagine selezionata.');
  }
  return { base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' };
}

export async function pickImageFromCamera(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permesso fotocamera negato. Abilitalo nelle impostazioni per scansionare documenti.');
  }
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  return toPickedImage(result);
}

export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permesso libreria foto negato. Abilitalo nelle impostazioni per scansionare documenti.');
  }
  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  return toPickedImage(result);
}
