// WebGPU final-pipeline readback helper for Three.js WebGPURenderer.
// This file is the code block from references/native-webgpu-readback.md,
// shipped as a module. Keep the two identical; the reference explains every
// requirement, option and limit. Development-only: never ship it to players.

const capturesInProgress = new WeakSet();

async function stageNativeWebGPUFrame({
  THREE,
  renderer,
  renderFinalFrame,
  synchroniseFrame,
  checkPose,
  includeOverlays = true,
  settleFrames = 1,
  frameTimeoutMs = 2000,
}) {
  if (typeof renderFinalFrame !== 'function') {
    throw new Error('Pass renderFinalFrame: the function that draws the application\'s final frame.');
  }
  if (typeof synchroniseFrame !== 'function' ||
      typeof checkPose !== 'function') {
    throw new Error('Application-specific synchronisation and pose checks are required.');
  }
  if (!Number.isInteger(settleFrames) || settleFrames < 0) {
    throw new Error('settleFrames must be a whole number of frames.');
  }
  if (!Number.isFinite(frameTimeoutMs) || frameTimeoutMs <= 0) {
    throw new Error('frameTimeoutMs must be a positive number of milliseconds.');
  }
  if (capturesInProgress.has(renderer)) {
    throw new Error('A capture is already running or still on screen for this renderer. ' +
      'Call cleanup() on the previous capture first.');
  }
  capturesInProgress.add(renderer);

  const previousLoop = renderer.getAnimationLoop();
  const ownRender = Object.prototype.hasOwnProperty.call(renderer, 'render');
  const render = renderer.render;
  let routing = false;
  let otherRenders = 0;
  let target = null;
  let presentation = null;

  // Count renders the helper did not make. Inside a routed frame, keep the
  // canvas behaviour: drawing to the canvas leaves no render target bound,
  // but drawing to an output target leaves that target bound. Unbinding it
  // keeps a clear() or clearDepth() between passes on the same buffer.
  renderer.render = function (...args) {
    if (!routing) {
      otherRenders += 1;
      return render.apply(this, args);
    }
    const bound = this.getRenderTarget();
    const result = render.apply(this, args);
    if (bound === null && this.getRenderTarget() === target) {
      this.setRenderTarget(null);
    }
    return result;
  };
  const restoreRender = () => {
    if (ownRender) renderer.render = render;
    else delete renderer.render;
  };
  const restoreLoop = () => {
    if (renderer.getAnimationLoop() === null) {
      renderer.setAnimationLoop(previousLoop);
    }
  };

  // Three.js 0.184 to 0.186 can recurse without end when a frame's first
  // operation on a fresh output target is a manual clear(). Clear the target
  // once as an ordinary render target first.
  function initialiseTarget() {
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      renderer.clear();
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }

  // Draw the application's final frame into the target as if it were the
  // screen, then restore routing before anything is awaited.
  function renderRouted() {
    const previousTarget = renderer.getRenderTarget();
    const previousOutput = renderer.getOutputRenderTarget();
    routing = true;
    try {
      renderer.setRenderTarget(null);
      renderer.setOutputRenderTarget(target);
      const result = renderFinalFrame();
      if (typeof result?.then === 'function') {
        throw new Error('renderFinalFrame() must draw synchronously. Do not pass an async function or renderAsync().');
      }
    } finally {
      routing = false;
      renderer.setOutputRenderTarget(previousOutput);
      renderer.setRenderTarget(previousTarget);
    }
  }

  try {
    await renderer.init();
    if (renderer.backend?.isWebGPUBackend !== true) {
      throw new Error('The application is not using the native WebGPU backend.');
    }

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = size.x;
    const height = size.y;
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width <= 0 || height <= 0) {
      throw new Error(`Invalid drawing-buffer dimensions (${width} x ${height}). ` +
        'If the game resizes from its canvas, ignore 0 x 0 sizes: the canvas ' +
        'leaves the page while a capture is shown.');
    }

    // Match the canvas's antialiasing, depth and stencil: some pipelines
    // draw straight into the output target, which would otherwise lack them.
    target = new THREE.RenderTarget(width, height, {
      type: THREE.UnsignedByteType,
      samples: renderer.samples,
      depthBuffer: renderer.depth,
      stencilBuffer: renderer.stencil,
    });

    // Pause the application's animation loop, so it can neither move the
    // staged state nor use up the frame that the capture renders in. It
    // stays paused until cleanup(), so DOM overlays keep the staged state.
    await renderer.setAnimationLoop(null);
    initialiseTarget();
    await synchroniseFrame();
    const staged = await checkPose();
    if (staged?.valid !== true) {
      throw new Error('Rendered transforms or camera do not match the requested state.');
    }

    // Per-frame work, including pipeline passes, runs at most once per
    // animation frame, so render at the start of fresh frames. Settle frames
    // let temporal effects catch up with the staged pose and are discarded;
    // the last frame is read back.
    for (let frame = 0; frame <= settleFrames; frame += 1) {
      await nextAnimationFrame(frameTimeoutMs);
      renderRouted();
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target, 0, 0, width, height,
    );
    if (otherRenders > 0) {
      throw new Error(`renderer.render() was called ${otherRenders} time(s) outside ` +
        'renderFinalFrame() during the capture. Pause any render loop the application ' +
        'runs outside renderer.setAnimationLoop(), and do not render in ' +
        'synchroniseFrame() or checkPose().');
    }
    restoreRender();
    const pose = await checkPose();
    if (pose?.valid !== true) {
      throw new Error('The application state changed during capture.');
    }

    const converted = toCanvas2DPixels(
      toTightRGBA8(pixels, width, height), renderer.alpha,
    );
    presentation = presentReadback(renderer.domElement, converted.rgba,
      width, height, includeOverlays);
    await nextAnimationFrame(frameTimeoutMs);
    await nextAnimationFrame(frameTimeoutMs);

    const shown = presentation;
    presentation = null;
    let cleaned = false;
    return {
      canvas: shown.canvas,
      metadata: {
        method: 'staged-native-webgpu-final-pipeline-readback',
        pixelWidth: width,
        pixelHeight: height,
        pose,
        settleFrames,
        presentation: shown.placement,
        includesDOMOverlays: shown.includesDOMOverlays,
        hiddenElements: shown.hiddenElements,
        canvasAlphaMode: renderer.alpha ? 'premultiplied' : 'opaque',
        nonOpaquePixels: converted.nonOpaquePixels,
        inexactAlphaPixels: converted.inexactAlphaPixels,
      },
      // Put the live canvas back and resume the application's loop.
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        shown.remove();
        restoreLoop();
        capturesInProgress.delete(renderer);
      },
    };
  } catch (error) {
    presentation?.remove();
    restoreRender();
    restoreLoop();
    capturesInProgress.delete(renderer);
    throw error;
  } finally {
    target?.dispose();
  }
}

function nextAnimationFrame(timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer = 0;
    const request = requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
    timer = setTimeout(() => {
      cancelAnimationFrame(request);
      const visible = document.visibilityState === 'visible';
      reject(new Error(`No animation frame arrived within ${timeoutMs} ms ` +
        `(page visibility: ${document.visibilityState}). ` +
        (visible
          ? 'The adapter may be too slow for this timeout: raise frameTimeoutMs. '
          : 'Bring the page to the foreground. ') +
        'Pipeline passes only refresh on animation frames.'));
    }, timeoutMs);
  });
}

// Three.js WebGPU readback pads each row to a multiple of 256 bytes whenever
// width * 4 is not already one. Accept that layout or a tightly packed one.
function toTightRGBA8(pixels, width, height) {
  if (!ArrayBuffer.isView(pixels) || pixels.BYTES_PER_ELEMENT !== 1) {
    throw new Error('Readback is not 8 bits per channel. Adapt its layout explicitly.');
  }
  const rowBytes = width * 4;
  const alignedBytesPerRow = Math.ceil(rowBytes / 256) * 256;
  if (pixels.byteLength === rowBytes * height) {
    return new Uint8ClampedArray(
      pixels.buffer, pixels.byteOffset, pixels.byteLength,
    );
  }
  if (pixels.byteLength === (height - 1) * alignedBytesPerRow + rowBytes) {
    return unpackRGBA8Rows(pixels, width, height, alignedBytesPerRow);
  }
  throw new Error(`Unexpected readback length ${pixels.byteLength} for ` +
    `${width}x${height} RGBA8. Adapt its layout explicitly.`);
}

function unpackRGBA8Rows(source, width, height, bytesPerRow) {
  const rowBytes = width * 4;
  const requiredLength = (height - 1) * bytesPerRow + rowBytes;
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0 ||
      !Number.isInteger(bytesPerRow) || bytesPerRow < rowBytes ||
      source.byteLength < requiredLength) {
    throw new Error('Invalid readback dimensions, stride or buffer length.');
  }
  const packed = new Uint8ClampedArray(rowBytes * height);
  const bytes = new Uint8Array(
    source.buffer, source.byteOffset, source.byteLength,
  );
  for (let y = 0; y < height; y++) {
    packed.set(bytes.subarray(y * bytesPerRow, y * bytesPerRow + rowBytes),
      y * rowBytes);
  }
  return packed;
}

// The browser shows a WebGPU canvas as premultiplied alpha, or as opaque when
// the renderer was created with alpha: false. Canvas2D expects straight alpha.
function toCanvas2DPixels(rgba, canvasHasAlpha) {
  let nonOpaquePixels = 0;
  let inexactAlphaPixels = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    if (!canvasHasAlpha) {
      rgba[i + 3] = 255;
      continue;
    }
    if (alpha === 255) continue;
    nonOpaquePixels += 1;
    // A colour channel above alpha is out of range for premultiplied alpha;
    // straight alpha cannot represent it, so such pixels are approximated.
    if (rgba[i] > alpha || rgba[i + 1] > alpha || rgba[i + 2] > alpha) {
      inexactAlphaPixels += 1;
    }
    if (alpha > 0) {
      const scale = 255 / alpha;
      rgba[i] *= scale;
      rgba[i + 1] *= scale;
      rgba[i + 2] *= scale;
    }
  }
  return { rgba, nonOpaquePixels, inexactAlphaPixels };
}

// Show the pixels in the WebGPU canvas's own place on the page: swap the live
// canvas for a Canvas2D copy with the same attributes, so layout, CSS and the
// stacking under DOM overlays such as the HUD stay exactly as in the game.
function presentReadback(source, rgba, width, height, includeOverlays) {
  const canvas = document.createElement('canvas');
  for (const { name, value } of source.attributes ?? []) {
    canvas.setAttribute(name, value);
  }
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.webgpuVerification = 'native-readback';
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D presentation is unavailable.');
  context.putImageData(new ImageData(rgba, width, height), 0, 0);

  if (!source.isConnected) {
    // Offscreen sessions may never attach the canvas: fill the viewport.
    canvas.removeAttribute('id');
    canvas.removeAttribute('class');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;' +
      'z-index:2147483647;pointer-events:none';
    document.body.appendChild(canvas);
    return {
      canvas,
      placement: 'full-viewport',
      includesDOMOverlays: false,
      hiddenElements: 0,
      remove: () => canvas.remove(),
    };
  }

  source.replaceWith(canvas);
  let overlays = null;
  try {
    finishRestartedAnimations(canvas);
    overlays = includeOverlays ? null : hideOverlays(canvas);
  } catch (error) {
    canvas.replaceWith(source);
    throw error;
  }
  return {
    canvas,
    placement: 'in-place',
    includesDOMOverlays: includeOverlays,
    hiddenElements: overlays?.count ?? 0,
    remove: () => {
      overlays?.restore();
      if (canvas.isConnected) {
        canvas.replaceWith(source);
        finishRestartedAnimations(source);
      }
    },
  };
}

// A CSS animation on the canvas, such as a fade-in, restarts whenever the
// element is inserted. Jump finite ones to their end, as on the live canvas.
function finishRestartedAnimations(element) {
  for (const animation of element.getAnimations?.() ?? []) {
    if (animation.effect?.getComputedTiming().endTime !== Infinity) {
      animation.finish();
    }
  }
}

// For a scene-only image, hide every element except the canvas copy and its
// ancestors. Layout, page backgrounds and the canvas's own CSS stay as they
// are. Text or pseudo-elements belonging to the ancestors themselves, and
// descendants that force visibility: visible, are not hidden.
function hideOverlays(canvas) {
  const hidden = [];
  for (let node = canvas; node.parentNode && node.parentNode !== document;) {
    const parent = node.parentNode;
    for (const sibling of parent.children) {
      if (sibling === node || !sibling.style) continue;
      hidden.push([
        sibling,
        sibling.style.getPropertyValue('visibility'),
        sibling.style.getPropertyPriority('visibility'),
      ]);
      sibling.style.setProperty('visibility', 'hidden', 'important');
    }
    // Step out of a shadow root to its host element.
    node = parent instanceof ShadowRoot ? parent.host : parent;
  }
  return {
    count: hidden.length,
    restore: () => {
      for (const [element, value, priority] of hidden) {
        if (value) element.style.setProperty('visibility', value, priority);
        else element.style.removeProperty('visibility');
      }
    },
  };
}

export { stageNativeWebGPUFrame };
