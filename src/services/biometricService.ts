import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return false;
  }
  return LocalAuthentication.isEnrolledAsync();
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Annulla',
    disableDeviceFallback: false,
  });
  return result.success;
}
