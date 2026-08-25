import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

const SINGLE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  allowsEditing: false,
};

const MULTI_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  allowsEditing: false,
  allowsMultipleSelection: true,
};

function toPickedImages(result: ImagePicker.ImagePickerResult): PickedImage[] {
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return [];
  }
  return result.assets.map((asset) => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}

export async function pickImageFromCamera(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permesso fotocamera negato. Abilitalo nelle impostazioni per scansionare documenti.');
  }
  const result = await ImagePicker.launchCameraAsync(SINGLE_PICKER_OPTIONS);
  const images = toPickedImages(result);
  return images[0] ?? null;
}

export async function pickImagesFromLibrary(): Promise<PickedImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permesso libreria foto negato. Abilitalo nelle impostazioni per scansionare documenti.');
  }
  const result = await ImagePicker.launchImageLibraryAsync(MULTI_PICKER_OPTIONS);
  return toPickedImages(result);
}
