import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function createPNG(size) {
  const width = size;
  const height = size;
  const pixels = Buffer.alloc(width * height * 4);

  // Background: #1e40af (blue)
  const bgR = 30, bgG = 64, bgB = 175;
  // House: white
  const hR = 255, hG = 255, hB = 255;

  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = bgR;
    pixels[i * 4 + 1] = bgG;
    pixels[i * 4 + 2] = bgB;
    pixels[i * 4 + 3] = 255;
  }

  // Draw house
  const cx = Math.floor(width / 2);
  const roofTop = Math.floor(height * 0.18);
  const roofBottom = Math.floor(height * 0.45);
  const wallBottom = Math.floor(height * 0.82);
  const wallLeft = Math.floor(width * 0.22);
  const wallRight = Math.floor(width * 0.78);

  // Roof triangle
  for (let y = roofTop; y < roofBottom; y++) {
    const progress = (y - roofTop) / (roofBottom - roofTop);
    const halfWidth = Math.floor(progress * (wallRight - wallLeft) / 2);
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      if (x >= 0 && x < width) {
        const idx = (y * width + x) * 4;
        pixels[idx] = hR; pixels[idx + 1] = hG; pixels[idx + 2] = hB; pixels[idx + 3] = 255;
      }
    }
  }

  // Walls
  for (let y = roofBottom; y < wallBottom; y++) {
    for (let x = wallLeft; x < wallRight; x++) {
      const idx = (y * width + x) * 4;
      pixels[idx] = hR; pixels[idx + 1] = hG; pixels[idx + 2] = hB; pixels[idx + 3] = 255;
    }
  }

  // Door (blue on white)
  const doorLeft = Math.floor(width * 0.4);
  const doorRight = Math.floor(width * 0.6);
  const doorTop = Math.floor(height * 0.58);
  for (let y = doorTop; y < wallBottom; y++) {
    for (let x = doorLeft; x < doorRight; x++) {
      const idx = (y * width + x) * 4;
      pixels[idx] = bgR; pixels[idx + 1] = bgG; pixels[idx + 2] = bgB; pixels[idx + 3] = 255;
    }
  }

  // Windows (blue squares)
  const winSize = Math.floor(width * 0.1);
  const winTop = Math.floor(height * 0.48);
  const winLeftX = Math.floor(width * 0.28);
  const winRightX = Math.floor(width * 0.62);
  for (const wx of [winLeftX, winRightX]) {
    for (let y = winTop; y < winTop + winSize; y++) {
      for (let x = wx; x < wx + winSize; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 96; pixels[idx + 1] = 165; pixels[idx + 2] = 250; pixels[idx + 3] = 255;
      }
    }
  }

  // Create PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0;
    pixels.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(rawData);

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });

writeFileSync('public/icons/icon-192x192.png', createPNG(192));
console.log('Generated icon-192x192.png');

writeFileSync('public/icons/icon-512x512.png', createPNG(512));
console.log('Generated icon-512x512.png');

writeFileSync('public/apple-touch-icon.png', createPNG(180));
console.log('Generated apple-touch-icon.png');
