const QR_SIZE = 25;
const DATA_CODEWORDS = 34;
const EC_CODEWORDS = 10;
const FORMAT_L_MASK_0 = 0b111011111000100;

function toBytes(value) {
  return Array.from(String(value || ''), (char) => char.charCodeAt(0) & 0xff);
}

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >> i) & 1);
  }
}

function bitsToCodewords(bits) {
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | (bits[i + j] || 0);
    }
    out.push(byte);
  }
  return out;
}

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
let value = 1;
for (let i = 0; i < 255; i += 1) {
  GF_EXP[i] = value;
  GF_LOG[value] = i;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) {
  GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a, b) {
  if (!a || !b) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function generatorPolynomial(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((coefficient, index) => {
      next[index] ^= gfMul(coefficient, 1);
      next[index + 1] ^= gfMul(coefficient, GF_EXP[i]);
    });
    poly = next;
  }
  return poly;
}

function reedSolomon(data, degree) {
  const generator = generatorPolynomial(degree);
  const message = [...data, ...new Array(degree).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const coefficient = message[i];
    if (!coefficient) continue;
    for (let j = 0; j < generator.length; j += 1) {
      message[i + j] ^= gfMul(generator[j], coefficient);
    }
  }
  return message.slice(data.length);
}

function encodeData(payload) {
  const bytes = toBytes(payload);
  const limitedBytes = bytes.slice(0, 32);
  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, limitedBytes.length, 8);
  limitedBytes.forEach((byte) => pushBits(bits, byte, 8));
  pushBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);

  const data = bitsToCodewords(bits);
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(pads[padIndex % 2]);
    padIndex += 1;
  }
  return data;
}

function createMatrix() {
  return Array.from({ length: QR_SIZE }, () =>
    Array.from({ length: QR_SIZE }, () => ({ dark: false, reserved: false })),
  );
}

function setModule(matrix, row, col, dark, reserved = true) {
  if (row < 0 || col < 0 || row >= QR_SIZE || col >= QR_SIZE) return;
  matrix[row][col] = { dark: Boolean(dark), reserved };
}

function addFinder(matrix, row, col) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const isRing = inOuter && (r === 0 || r === 6 || c === 0 || c === 6);
      setModule(matrix, rr, cc, isRing || inInner, true);
    }
  }
}

function addAlignment(matrix, row, col) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const edge = Math.abs(r) === 2 || Math.abs(c) === 2;
      const center = r === 0 && c === 0;
      setModule(matrix, row + r, col + c, edge || center, true);
    }
  }
}

function addPatterns(matrix) {
  addFinder(matrix, 0, 0);
  addFinder(matrix, 0, QR_SIZE - 7);
  addFinder(matrix, QR_SIZE - 7, 0);
  addAlignment(matrix, 18, 18);

  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    setModule(matrix, 6, i, i % 2 === 0, true);
    setModule(matrix, i, 6, i % 2 === 0, true);
  }
  setModule(matrix, QR_SIZE - 8, 8, true, true);
}

function reserveFormat(matrix) {
  const points = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
    [QR_SIZE - 1, 8],
    [QR_SIZE - 2, 8],
    [QR_SIZE - 3, 8],
    [QR_SIZE - 4, 8],
    [QR_SIZE - 5, 8],
    [QR_SIZE - 6, 8],
    [QR_SIZE - 7, 8],
    [8, QR_SIZE - 8],
    [8, QR_SIZE - 7],
    [8, QR_SIZE - 6],
    [8, QR_SIZE - 5],
    [8, QR_SIZE - 4],
    [8, QR_SIZE - 3],
    [8, QR_SIZE - 2],
    [8, QR_SIZE - 1],
  ];
  points.forEach(([row, col]) => {
    matrix[row][col].reserved = true;
  });
}

function addFormat(matrix) {
  const bits = FORMAT_L_MASK_0.toString(2).padStart(15, '0').split('').map(Number);
  const first = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  const second = [
    [QR_SIZE - 1, 8],
    [QR_SIZE - 2, 8],
    [QR_SIZE - 3, 8],
    [QR_SIZE - 4, 8],
    [QR_SIZE - 5, 8],
    [QR_SIZE - 6, 8],
    [QR_SIZE - 7, 8],
    [8, QR_SIZE - 8],
    [8, QR_SIZE - 7],
    [8, QR_SIZE - 6],
    [8, QR_SIZE - 5],
    [8, QR_SIZE - 4],
    [8, QR_SIZE - 3],
    [8, QR_SIZE - 2],
    [8, QR_SIZE - 1],
  ];
  first.forEach(([row, col], index) => setModule(matrix, row, col, bits[index], true));
  second.forEach(([row, col], index) => setModule(matrix, row, col, bits[index], true));
}

function addData(matrix, codewords) {
  const bits = [];
  codewords.forEach((byte) => pushBits(bits, byte, 8));
  let bitIndex = 0;
  let upward = true;

  for (let col = QR_SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let rowStep = 0; rowStep < QR_SIZE; rowStep += 1) {
      const row = upward ? QR_SIZE - 1 - rowStep : rowStep;
      for (let offset = 0; offset < 2; offset += 1) {
        const currentCol = col - offset;
        if (matrix[row][currentCol].reserved) continue;
        const raw = bits[bitIndex] || 0;
        const masked = raw ^ ((row + currentCol) % 2 === 0 ? 1 : 0);
        setModule(matrix, row, currentCol, masked, false);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

export function createQrMatrix(payload) {
  const data = encodeData(payload);
  const codewords = [...data, ...reedSolomon(data, EC_CODEWORDS)];
  const matrix = createMatrix();
  addPatterns(matrix);
  reserveFormat(matrix);
  addData(matrix, codewords);
  addFormat(matrix);
  return matrix.map((row) => row.map((cell) => cell.dark));
}
