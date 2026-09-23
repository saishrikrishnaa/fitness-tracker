import * as SecureStore from 'expo-secure-store';

const API_KEY_KEY = 'fuel_gemini_api_key';
const VAULT_PIN_KEY = 'fuel_vault_pin';

export async function getApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(API_KEY_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_KEY, key.trim());
}

export async function getVaultPin(): Promise<string> {
  const pin = await SecureStore.getItemAsync(VAULT_PIN_KEY);
  return pin || '1234';
}

export async function setVaultPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(VAULT_PIN_KEY, pin.trim());
}
