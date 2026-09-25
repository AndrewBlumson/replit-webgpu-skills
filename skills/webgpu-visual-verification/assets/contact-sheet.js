// Contact sheet for scripted playthroughs: collects labelled thumbnails of
// readback captures and shows them as one image, so a single screenshot
// reports a whole run. Development-only: never ship it to players.
//
//   const sheet = createContactSheet({ title: 'Level 1: main route' });
//   sheet.add({ canvas: capture.canvas, label: 'Clears the gap',
//     lines: ['tick 142', 'y 1.00', 'grounded yes'], status: 'pass' });
//   capture.cleanup();
//   const shown = sheet.present();   // screenshot now, then shown.cleanup()

const STATUS_COLOURS = {
  pass: '#2e9d57',
  fail: '#d23f3f',
  info: '#5a6b85',
};
// Brighter versions for status words drawn on the dark caption background.
const STATUS_TEXT_COLOURS = {
  pass: '#5fd38a',
  fail: '#ff6b6b',
};
const MAX_CAPTION_ROWS = 8;

export function createContactSheet({
  title = 'Scripted playthrough',
  columns = 3,
  tileWidth = 480,
} = {}) {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new Error('columns must be a whole number of at least 1.');
  }
  // Thumbnails fit inside tileWidth x thumbHeight, so portrait captures do
  // not make every row tall.
  const thumbHeight = Math.round(tileWidth * 0.75);
  const tiles = [];

  return {
    get count() {
      return tiles.length;
    },

    // Copy the capture now, so the caller can clean the capture up straight
    // away. `canvas` is the canvas returned by the readback helper.
    add({ canvas, label = '', lines = [], status = 'info' }) {
      if (!canvas || !canvas.width || !canvas.height) {
        throw new Error('add() needs the canvas returned by a readback capture.');
      }
      if (!Array.isArray(lines)) {
        throw new Error('lines must be an array of short text lines.');
      }
      const scale = Math.min(tileWidth / canvas.width, thumbHeight / canvas.height);
      const thumb = document.createElement('canvas');
      thumb.width = Math.max(1, Math.round(canvas.width * scale));
      thumb.height = Math.max(1, Math.round(canvas.height * scale));
      const context = thumb.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(canvas, 0, 0, thumb.width, thumb.height);
      tiles.push({ thumb, label: String(label), lines: lines.map(String), status: String(status) });
      return tiles.length;
    },

    // Draw one page of tiles and show it over the whole viewport. The image is
    // scaled to fit the viewport; `metadata.pages` says how many pages exist.
    // Six tiles a page stay readable in a 1280 x 800 screenshot.
    present({ page = 0, perPage = 6 } = {}) {
      if (tiles.length === 0) throw new Error('The contact sheet has no captures.');
      if (!Number.isInteger(perPage) || perPage < 1) {
        throw new Error('perPage must be a whole number of at least 1.');
      }
      const pages = Math.ceil(tiles.length / perPage);
      if (!Number.isInteger(page) || page < 0 || page >= pages) {
        throw new Error(`page must be a whole number from 0 to ${pages - 1}.`);
      }
      const shown = tiles.slice(page * perPage, (page + 1) * perPage);
      const gap = 16;
      const headerHeight = 56;
      const captionLine = 22;
      const sheet = document.createElement('canvas');
      const context = sheet.getContext('2d');
      context.font = '15px ui-monospace, Menlo, monospace';
      const rows = shown.map((tile) => captionRows(context, tile.lines, tileWidth - 20));
      const captionHeight = 40 + captionLine *
        Math.max(1, ...rows.map((tileRows) => tileRows.length));
      const tileHeight = Math.max(...shown.map((tile) => tile.thumb.height));
      const cols = Math.min(columns, shown.length);
      const gridRows = Math.ceil(shown.length / cols);
      sheet.width = gap + cols * (tileWidth + gap);
      sheet.height = headerHeight + gap +
        gridRows * (tileHeight + captionHeight + gap);

      context.fillStyle = '#10141c';
      context.fillRect(0, 0, sheet.width, sheet.height);
      context.fillStyle = '#ffffff';
      context.font = '600 26px system-ui, sans-serif';
      context.textBaseline = 'middle';
      // Keep the page number visible however long the title is.
      const pageText = pages > 1 ? `  (page ${page + 1} of ${pages})` : '';
      const titleText = fitString(context, title,
        sheet.width - 2 * gap - context.measureText(pageText).width);
      context.fillText(`${titleText}${pageText}`, gap, headerHeight / 2 + 4);

      shown.forEach((tile, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = gap + col * (tileWidth + gap);
        const y = headerHeight + gap + row * (tileHeight + captionHeight + gap);
        context.drawImage(tile.thumb, x + Math.floor((tileWidth - tile.thumb.width) / 2), y);

        const colour = STATUS_COLOURS[tile.status] ?? STATUS_COLOURS.info;
        context.fillStyle = colour;
        context.fillRect(x, y + tileHeight, tileWidth, 6);
        context.fillStyle = '#1b2230';
        context.fillRect(x, y + tileHeight + 6, tileWidth, captionHeight - 6);
        if (tile.status === 'fail') {
          context.strokeStyle = colour;
          context.lineWidth = 4;
          context.strokeRect(x - 2, y - 2, tileWidth + 4, tileHeight + captionHeight + 4);
        }

        // Number and status first, so a long label never hides PASS or FAIL.
        const number = page * perPage + index + 1;
        const labelY = y + tileHeight + 26;
        let textX = x + 10;
        context.font = '600 19px system-ui, sans-serif';
        context.fillStyle = '#ffffff';
        context.fillText(`${number}. `, textX, labelY);
        textX += context.measureText(`${number}. `).width;
        if (tile.status !== 'info') {
          const word = `${tile.status.toUpperCase()}  `;
          context.fillStyle = STATUS_TEXT_COLOURS[tile.status] ?? '#ffffff';
          context.fillText(word, textX, labelY);
          textX += context.measureText(word).width;
        }
        context.fillStyle = '#ffffff';
        context.fillText(fitString(context, tile.label, x + tileWidth - 10 - textX), textX, labelY);

        context.font = '15px ui-monospace, Menlo, monospace';
        rows[index].forEach((captionRow, rowIndex) => {
          context.fillStyle = captionRow.note ? '#ffb3b3' : '#c9d3e3';
          context.fillText(captionRow.text, x + 10, labelY + captionLine * (rowIndex + 1));
        });
      });

      sheet.dataset.webgpuVerification = 'contact-sheet';
      sheet.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;' +
        'object-fit:contain;background:#10141c;z-index:2147483647;' +
        'pointer-events:none';
      document.body.appendChild(sheet);
      return {
        canvas: sheet,
        metadata: {
          method: 'contact-sheet-of-staged-readback-captures',
          title,
          page,
          pages,
          tiles: shown.length,
          totalTiles: tiles.length,
          pixelWidth: sheet.width,
          pixelHeight: sheet.height,
        },
        cleanup: () => sheet.remove(),
      };
    },
  };
}

// Caption rows for one tile. A failure note (a line starting with ">> ")
// wraps onto up to three rows; other lines are shortened with an ellipsis.
function captionRows(context, lines, maxWidth) {
  const rows = [];
  for (const line of lines) {
    if (line.startsWith('>> ')) {
      for (const text of wrapString(context, line, maxWidth, 3)) rows.push({ text, note: true });
    } else {
      rows.push({ text: fitString(context, line, maxWidth), note: false });
    }
  }
  if (rows.length > MAX_CAPTION_ROWS) {
    const hidden = rows.length - (MAX_CAPTION_ROWS - 1);
    rows.length = MAX_CAPTION_ROWS - 1;
    rows.push({ text: `… ${hidden} more lines`, note: false });
  }
  return rows;
}

function wrapString(context, text, maxWidth, maxRows) {
  const rows = [];
  let rest = text;
  while (rest && rows.length < maxRows - 1 && context.measureText(rest).width > maxWidth) {
    let cut = fitString(context, rest, maxWidth).length - 1;
    const space = rest.lastIndexOf(' ', cut);
    if (space > 0) cut = space;
    rows.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) rows.push(fitString(context, rest, maxWidth));
  return rows;
}

// Shorten text with an ellipsis so it never runs into the next tile. A binary
// search keeps very long lines cheap.
function fitString(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (context.measureText(`${text.slice(0, middle)}…`).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${text.slice(0, low)}…`;
}
