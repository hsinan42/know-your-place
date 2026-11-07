const key = 'finance:remembered-username';

export function rememberedUsername() {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function rememberUsername(username: string) {
  try {
    if (username) localStorage.setItem(key, username);
    else localStorage.removeItem(key);
  } catch {
    // The sign-in form still works when storage is unavailable.
  }
}

export async function offerPasswordToBrowser(username: string, password: string) {
  const PasswordCredential = (window as Window & {
    PasswordCredential?: new (input: { id: string; password: string }) => Credential;
  }).PasswordCredential;
  if (!PasswordCredential || !navigator.credentials) return;
  try {
    await navigator.credentials.store(new PasswordCredential({ id: username, password }));
  } catch {
    // Browsers can fall back to normal form autofill.
  }
}
