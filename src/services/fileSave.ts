/**
 * Hands a file the app made to the phone or computer. Android and computers download it straight
 * away. iPhones and iPads get the share sheet (Save to Files, Print, AirDrop…), because a
 * download from an app on the home screen opens a viewer there with no way back to the app.
 */

/**
 * - downloaded: handed to the browser's downloads.
 * - shared: the share sheet took it.
 * - cancelled: the share sheet was closed without choosing anything.
 * - needs-tap: the share sheet opens only straight from a tap, and the tap was too long ago
 *   (the file took a while to make): calling this again from a new tap will work.
 */
export type SaveOutcome = 'downloaded' | 'shared' | 'cancelled' | 'needs-tap';

function usesShareSheet(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  // iPads report themselves as Macs, but Macs have no touch screen.
  const iOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && typeof navigator.share === 'function';
}

export async function saveFile(
  bytes: Uint8Array<ArrayBuffer>,
  fileName: string,
  type: string,
): Promise<SaveOutcome> {
  if (usesShareSheet()) {
    const file = new File([bytes], fileName, { type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
        if (err instanceof DOMException && err.name === 'NotAllowedError') return 'needs-tap';
        throw err;
      }
    }
  }
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for the download to have started, however slow the phone.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
