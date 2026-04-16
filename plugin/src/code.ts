figma.showUI(__html__, { width: 300, height: 200 });

let insertOffset = 0;

interface InsertImageMessage {
  type: 'insert-image';
  imageUrl: string;
}

interface InsertFallbackMessage {
  type: 'insert-fallback';
  letters: string;
}

type PluginMessage = InsertImageMessage | InsertFallbackMessage;

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'insert-image') {
    await insertImage(msg.imageUrl);
  } else if (msg.type === 'insert-fallback') {
    await insertFallback(msg.letters);
  }
};

async function insertImage(imageUrl: string): Promise<void> {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const imageHash = figma.createImage(new Uint8Array(buffer)).hash;

    const selection = figma.currentPage.selection;

    if (selection.length > 0) {
      const node = selection[0];
      if ('fills' in node) {
        node.fills = [
          {
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash,
          },
        ];
      }
    } else {
      const frame = figma.createFrame();
      frame.resize(48, 48);
      frame.cornerRadius = 24;
      frame.fills = [
        {
          type: 'IMAGE',
          scaleMode: 'FILL',
          imageHash,
        },
      ];

      const center = figma.viewport.center;
      frame.x = center.x + insertOffset;
      frame.y = center.y;
      insertOffset += 60;

      figma.currentPage.appendChild(frame);
    }

    figma.ui.postMessage({ type: 'insert-success' });
  } catch (error) {
    figma.ui.postMessage({ type: 'insert-error', error: String(error) });
  }
}

async function insertFallback(letters: string): Promise<void> {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

    const selection = figma.currentPage.selection;

    if (selection.length > 0) {
      const node = selection[0];

      if ('fills' in node) {
        node.fills = [
          {
            type: 'SOLID',
            color: { r: 0.769, g: 0.769, b: 0.769 }, // #C4C4C4
          },
        ];
      }

      // Create text node on top
      const text = figma.createText();
      text.fontName = { family: 'Inter', style: 'Bold' };
      text.characters = letters;
      text.fontSize = 18;
      text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      text.textAlignHorizontal = 'CENTER';
      text.textAlignVertical = 'CENTER';

      // Position text over the node
      if ('width' in node && 'height' in node) {
        text.resize(node.width as number, node.height as number);
        text.x = node.x;
        text.y = node.y;
      }

      const group = figma.group([node, text], figma.currentPage);
      group.name = `Fallback: ${letters}`;
    } else {
      const frame = figma.createFrame();
      frame.resize(48, 48);
      frame.cornerRadius = 24;
      frame.fills = [
        {
          type: 'SOLID',
          color: { r: 0.769, g: 0.769, b: 0.769 }, // #C4C4C4
        },
      ];
      frame.name = `Fallback: ${letters}`;

      const text = figma.createText();
      text.fontName = { family: 'Inter', style: 'Bold' };
      text.characters = letters;
      text.fontSize = 18;
      text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      text.textAlignHorizontal = 'CENTER';
      text.textAlignVertical = 'CENTER';
      text.resize(48, 48);

      frame.appendChild(text);
      text.x = 0;
      text.y = 0;

      const center = figma.viewport.center;
      frame.x = center.x + insertOffset;
      frame.y = center.y;
      insertOffset += 60;

      figma.currentPage.appendChild(frame);
    }

    figma.ui.postMessage({ type: 'insert-success' });
  } catch (error) {
    figma.ui.postMessage({ type: 'insert-error', error: String(error) });
  }
}
