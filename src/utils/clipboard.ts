/**
 * Copy text, reporting whether it actually landed.
 *
 * `navigator.clipboard` requires a secure context, so this fails on plain HTTP
 * over a LAN address. Callers must show the text when it returns false —
 * claiming "copied" when nothing was copied is worse than not offering the copy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
