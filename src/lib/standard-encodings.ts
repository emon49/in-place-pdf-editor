/** Characters drawable through a named simple-font encoding, for fonts with no embedded program (design D3). */

/** WinAnsi (Windows-1252) written out, because `TextDecoder` support for it differs between runtimes. */
function winAnsi(): Set<string> {
  const chars = new Set<string>();
  for (let code = 0x20; code <= 0x7e; code++) chars.add(String.fromCharCode(code));
  for (const c of '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ') chars.add(c); // 0x80-0x9F, minus the five undefined codes
  for (let code = 0xa1; code <= 0xff; code++) chars.add(String.fromCharCode(code)); // 0xA0 is a no-break space
  return chars;
}

/** PDF StandardEncoding differs from ASCII at the quotes and adds a set of Latin punctuation and letters. */
function standardEncoding(): Set<string> {
  const chars = new Set<string>();
  for (let code = 0x20; code <= 0x7e; code++) {
    if (code === 0x27 || code === 0x60) continue; // quoteright and quoteleft take these codes
    chars.add(String.fromCharCode(code));
  }
  for (const c of '’‘¡¢£⁄¥ƒ§¤\'“«‹›ﬁﬂ–†‡·¶•‚„”»…‰¿`´ˆ˜¯˘˙¨˚¸˝˛ˇ—ÆªŁØŒºæıłøœß') chars.add(c);
  return chars;
}

/**
 * The characters a named encoding can draw, or null when the encoding is unknown. A simple font with no
 * `Encoding` entry uses its built-in encoding, which for the Standard 14 text fonts is StandardEncoding.
 */
export function encodingCharacters(name: string | null): Set<string> | null {
  switch (name) {
    case 'WinAnsiEncoding':
      return winAnsi();
    case 'StandardEncoding':
    case null:
      return standardEncoding();
    default:
      return null;
  }
}
