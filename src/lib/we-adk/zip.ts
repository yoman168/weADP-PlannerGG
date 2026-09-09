/**
 * A zip file, written by hand.
 *
 * Two text files in one download needs an archive, and an archive is the only
 * thing in this app that a browser cannot already make. Rather than take a
 * dependency for it, this writes the format directly: entries are stored
 * uncompressed, which is the one method every unzip implementation has supported
 * since the format existed, and costs nothing worth having on documents this
 * size.
 *
 * Deliberately minimal — no directories, no compression, no zip64. Those exist
 * for archives this will never produce: a handful of text files, none of them
 * near the 4GB the 32-bit fields cap out at.
 */

export interface ZipEntry {
  /** Path inside the archive. Forward slashes make a folder. */
  name: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* CRC32                                                               */
/* ------------------------------------------------------------------ */

/**
 * The polynomial table, built once.
 *
 * Zip stores a CRC32 per entry and unzip checks it, so this is not optional
 * bookkeeping — get it wrong and every archive reads as corrupt.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */
/* MS-DOS timestamps                                                   */
/* ------------------------------------------------------------------ */

/**
 * The date fields zip inherited from DOS: seconds in two-second steps, and a
 * year counted from 1980. A file stamped before 1980 cannot be expressed, so it
 * is clamped rather than written as a negative year that unzip would reject.
 */
function dosStamp(at: Date): { time: number; date: number } {
  const year = Math.max(at.getFullYear(), 1980);
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | Math.floor(at.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  };
}

/* ------------------------------------------------------------------ */
/* Writing                                                            */
/* ------------------------------------------------------------------ */

/** Bit 11 of the flags: the name and comment are UTF-8, not code page 437. */
const UTF8_FLAG = 0x0800;
const STORED = 0;
const VERSION = 20;

interface Prepared {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

/**
 * A zip of the given text entries.
 *
 * The layout is the one the spec describes: every entry's local header and data
 * in order, then a central directory repeating each entry with the offset of its
 * local header, then the end-of-central-directory record. Readers work backwards
 * from that last record, which is why the offsets have to be exact rather than
 * approximately right.
 */
export function zipBlob(entries: ZipEntry[], at: Date = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosStamp(at);

  const prepared: Prepared[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = encoder.encode(entry.text);
    const crc = crc32(data);

    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, UTF8_FLAG, true);
    view.setUint16(8, STORED, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);

    prepared.push({ nameBytes, data, crc, offset });
    chunks.push(header, nameBytes, data);
    offset += header.length + nameBytes.length + data.length;
  }

  const directoryOffset = offset;
  let directorySize = 0;

  for (const entry of prepared) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, VERSION, true);
    view.setUint16(8, UTF8_FLAG, true);
    view.setUint16(10, STORED, true);
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);

    chunks.push(header, entry.nameBytes);
    directorySize += header.length + entry.nameBytes.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, prepared.length, true);
  endView.setUint16(10, prepared.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, directoryOffset, true);
  endView.setUint16(20, 0, true);
  chunks.push(end);

  // `BlobPart[]` rather than one concatenated buffer: Blob already stitches the
  // pieces, so copying them into a single array first would double the memory
  // for no gain.
  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}
