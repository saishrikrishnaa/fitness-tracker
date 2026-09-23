import * as FileSystem from 'expo-file-system';

export async function savePhotoLocally(tempUri: string, folder: 'meals' | 'progress'): Promise<string> {
  const dir = `${FileSystem.documentDirectory}fuel_media/${folder}/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${folder}_${timestamp}.jpg`;
  const destUri = `${dir}${filename}`;

  await FileSystem.copyAsync({
    from: tempUri,
    to: destUri,
  });

  return destUri;
}
