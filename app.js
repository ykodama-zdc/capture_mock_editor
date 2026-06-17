const fileInput = document.getElementById('fileInput');
const fileInputSingle = document.getElementById('fileInputSingle');
const saveProjectBtn = document.getElementById('saveProject');
const saveImageMode = document.getElementById('saveImageMode');
const loadProjectInput = document.getElementById('loadProject');
const loadProjectBtn = document.getElementById('loadProjectBtn');
const thumbsEl = document.getElementById('thumbs');
const imageCountEl = document.getElementById('imageCount');
const currentNameEl = document.getElementById('currentName');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const previewZoomWrap = document.getElementById('previewZoomWrap');
const outputPresetSelect = document.getElementById('outputPreset');
const customOutputFields = document.getElementById('customOutputFields');
const outputWidthInput = document.getElementById('outputWidth');
const outputHeightInput = document.getElementById('outputHeight');
const cropSizeInfo = document.getElementById('cropSizeInfo');
const bgColorInput = document.getElementById('bgColor');
const saveCroppedImageBtn = document.getElementById('saveCroppedImage');
const resetCropBtn = document.getElementById('resetCrop');
const applyCropAllBtn = document.getElementById('applyCropAll');
const exportBtn = document.getElementById('exportBtn');
const cropHint = document.getElementById('cropHint');
const addHotspotBtn = document.getElementById('addHotspot');
const hotspotList = document.getElementById('hotspotList');
const hotspotHint = document.getElementById('hotspotHint');
const addMaskBtn = document.getElementById('addMask');
const maskList = document.getElementById('maskList');
const maskHint = document.getElementById('maskHint');
const modeCropBtn = document.getElementById('modeCrop');
const modeHotspotBtn = document.getElementById('modeHotspot');
const modeMaskBtn = document.getElementById('modeMask');
const cropStage = document.getElementById('cropStage');
const previewStage = document.getElementById('previewStage');
const cropControls = document.getElementById('cropControls');
const hotspotControls = document.getElementById('hotspotControls');
const maskControls = document.getElementById('maskControls');
const centerPanel = document.getElementById('centerPanel');
const debugHud = document.getElementById('debugHud');
const rightPanelHeader = document.getElementById('rightPanelHeader');
const rightPanelTitle = document.getElementById('rightPanelTitle');
const rightPanelMeta = document.getElementById('rightPanelMeta');
const exportNote = document.getElementById('exportNote');

const hotspotCursorSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.6)"/></filter></defs><g filter="url(#shadow)" stroke="#ffffff" stroke-width="2" stroke-linecap="round"><line x1="16" y1="4" x2="16" y2="28"/><line x1="4" y1="16" x2="28" y2="16"/></g><circle cx="16" cy="16" r="2" fill="#2dd4bf"/></svg>';
const HOTSPOT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(hotspotCursorSvg)}") 16 16, crosshair`;
const MIN_INTERACTIVE_RECT_SIZE = 8;
const OUTPUT_PRESETS = {
  '1920x1080': { w: 1920, h: 1080 },
  '1600x900': { w: 1600, h: 900 },
  '1366x768': { w: 1366, h: 768 },
  '1280x720': { w: 1280, h: 720 },
  '1080x1920': { w: 1080, h: 1920 },
  '768x1024': { w: 768, h: 1024 },
  '390x844': { w: 390, h: 844 },
};

const state = {
  items: [],
  selectedId: null,
  output: {
    w: 1920,
    h: 1080,
    bg: '#0b0f1a',
    preset: 'selection',
  },
  drag: null,
  display: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    boxW: cropCanvas.width,
    boxH: cropCanvas.height,
  },
  hotspot: {
    mode: 'idle',
    startX: 0,
    startY: 0,
    current: null,
    edit: null,
    moved: false,
    selectedId: null,
  },
  mask: {
    mode: 'idle',
    startX: 0,
    startY: 0,
    current: null,
    edit: null,
    moved: false,
  },
  preview: {
    zoom: 1,
    panX: 0,
    panY: 0,
    lastSelectedId: null,
    drag: null,
  },
  mode: 'crop',
  projectLoadStartHandle: null,
  syncingSelectionOutput: false,
};

function updateCount() {
  imageCountEl.textContent = `${state.items.length} items`;
}

function loadFiles(files) {
  const images = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!images.length) return;

  const sorted = images.sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(async file => {
    const dataUrl = await fileToDataUrl(file);
    const img = new Image();
    img.onload = () => {
      const shouldSyncOutput = state.items.length === 0;
      const item = {
        id: crypto.randomUUID(),
        name: file.name,
        file,
        url: dataUrl,
        dataUrl,
        img,
        crop: null,
        hotspots: [],
        masks: [],
      };
      item.crop = getDefaultCrop(item);
      state.items.push(item);
      if (!state.selectedId) {
        state.selectedId = item.id;
      }
      if (shouldSyncOutput) {
        state.output.w = item.img.naturalWidth;
        state.output.h = item.img.naturalHeight;
        state.output.preset = 'selection';
        syncOutputInputs();
        resizeCropCanvas();
        updatePreviewScale();
      }
      renderThumbs();
      render();
    };
    img.src = dataUrl;
  });
}

fileInput.addEventListener('change', e => loadFiles(e.target.files));
fileInputSingle.addEventListener('change', e => loadFiles(e.target.files));

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderThumbs() {
  thumbsEl.innerHTML = '';
  state.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'thumb' + (item.id === state.selectedId ? ' active' : '');
    div.draggable = true;
    div.addEventListener('click', () => {
      state.selectedId = item.id;
      renderThumbs();
      render();
    });
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', item.id);
    });
    div.addEventListener('dragover', e => {
      e.preventDefault();
      const rect = div.getBoundingClientRect();
      const isBefore = (e.clientY - rect.top) < rect.height / 2;
      div.classList.toggle('drag-before', isBefore);
      div.classList.toggle('drag-after', !isBefore);
    });
    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-before', 'drag-after');
    });
    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('drag-before', 'drag-after');
      const fromId = e.dataTransfer.getData('text/plain');
      if (!fromId || fromId === item.id) return;
      const fromIdx = state.items.findIndex(i => i.id === fromId);
      const toIdx = state.items.findIndex(i => i.id === item.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const moved = state.items.splice(fromIdx, 1)[0];
      const rect = div.getBoundingClientRect();
      const isBefore = (e.clientY - rect.top) < rect.height / 2;
      const insertIdx = isBefore ? toIdx : toIdx + 1;
      state.items.splice(insertIdx > fromIdx ? insertIdx - 1 : insertIdx, 0, moved);
      renderThumbs();
      render();
    });

    const img = document.createElement('img');
    img.src = item.url;

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;

    const actions = document.createElement('div');
    actions.className = 'thumb-actions';

    const del = document.createElement('button');
    del.className = 'secondary';
    del.textContent = '×';
    del.addEventListener('click', e => {
      e.stopPropagation();
      const idx = state.items.findIndex(i => i.id === item.id);
      if (idx < 0) return;
      state.items.splice(idx, 1);
      if (state.selectedId === item.id) {
        state.selectedId = state.items[0]?.id || null;
      }
      renderThumbs();
      render();
    });

    actions.appendChild(del);

    div.appendChild(img);
    div.appendChild(name);
    div.appendChild(actions);
    thumbsEl.appendChild(div);
  });
  updateCount();
}

function getSelected() {
  return state.items.find(i => i.id === state.selectedId) || null;
}

function getOutputRatio() {
  return state.output.w / state.output.h;
}

function formatPxSize(w, h) {
  return `${Math.round(w)} x ${Math.round(h)} px`;
}

function updateCropSizeInfo(item) {
  if (!cropSizeInfo) return;
  if (!item?.crop) {
    cropSizeInfo.textContent = '-';
    return;
  }
  const { w, h } = item.crop;
  cropSizeInfo.textContent = `${formatPxSize(w, h)} / 比率 ${(w / h).toFixed(3)}`;
}

function syncOutputInputs() {
  if (outputPresetSelect) outputPresetSelect.value = state.output.preset || 'custom';
  if (outputWidthInput) outputWidthInput.value = String(Math.round(state.output.w));
  if (outputHeightInput) outputHeightInput.value = String(Math.round(state.output.h));
  customOutputFields?.classList.toggle('stage-hidden', state.output.preset !== 'custom');
}

function getSelectedCropOutputSize(item) {
  if (!item?.crop) return null;
  return {
    w: Math.max(1, Math.round(item.crop.w)),
    h: Math.max(1, Math.round(item.crop.h)),
  };
}

function applyOutputPreset(preset) {
  state.output.preset = preset;
  if (preset === 'custom') {
    syncOutputInputs();
    return;
  }
  if (preset === 'selection') {
    const selected = getSelected();
    const size = getSelectedCropOutputSize(selected);
    syncOutputInputs();
    if (size) {
      setOutputSize(size.w, size.h);
    }
    return;
  }
  const next = OUTPUT_PRESETS[preset];
  syncOutputInputs();
  if (next) {
    setOutputSize(next.w, next.h);
  }
}

function syncSelectionPresetOutput(item) {
  if (state.output.preset !== 'selection' || !item?.crop || state.syncingSelectionOutput) return false;
  const next = getSelectedCropOutputSize(item);
  if (!next) return false;
  if (next.w === state.output.w && next.h === state.output.h) return false;
  state.syncingSelectionOutput = true;
  try {
    setOutputSize(next.w, next.h);
  } finally {
    state.syncingSelectionOutput = false;
  }
  return true;
}

function getFittedRect(srcW, srcH, destW, destH) {
  const scale = Math.min(destW / srcW, destH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  return {
    x: (destW - drawW) / 2,
    y: (destH - drawH) / 2,
    w: drawW,
    h: drawH,
  };
}

function drawItemToOutput(ctx, item, outW, outH, bg) {
  const crop = item.crop;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, outH);
  const fitted = getFittedRect(crop.w, crop.h, outW, outH);
  ctx.drawImage(
    item.img,
    crop.x, crop.y, crop.w, crop.h,
    fitted.x, fitted.y, fitted.w, fitted.h
  );
  drawMasks(ctx, item.masks || []);
}

function drawMasks(ctx, masks) {
  if (!masks.length) return;
  ctx.save();
  ctx.fillStyle = '#000000';
  masks.forEach(mask => {
    ctx.fillRect(mask.x, mask.y, mask.w, mask.h);
  });
  ctx.restore();
}

function scaleOutputRects(nextW, nextH) {
  const prevW = state.output.w || 1;
  const prevH = state.output.h || 1;
  const scaleX = nextW / prevW;
  const scaleY = nextH / prevH;
  state.items.forEach(item => {
    item.hotspots = (item.hotspots || []).map(h => ({
      ...h,
      x: h.x * scaleX,
      y: h.y * scaleY,
      w: h.w * scaleX,
      h: h.h * scaleY,
    }));
    item.masks = (item.masks || []).map(mask => ({
      ...mask,
      x: mask.x * scaleX,
      y: mask.y * scaleY,
      w: mask.w * scaleX,
      h: mask.h * scaleY,
    }));
  });
}

function setOutputSize(nextW, nextH) {
  const width = Math.max(1, Math.round(Number.isFinite(nextW) ? nextW : state.output.w));
  const height = Math.max(1, Math.round(Number.isFinite(nextH) ? nextH : state.output.h));
  if (width === state.output.w && height === state.output.h) {
    syncOutputInputs();
    return;
  }
  scaleOutputRects(width, height);
  state.output.w = width;
  state.output.h = height;
  resetPreviewZoom();
  syncOutputInputs();
  resizeCropCanvas();
  updatePreviewScale();
  render();
}

function resetPreviewZoom() {
  state.preview.zoom = 1;
  state.preview.panX = 0;
  state.preview.panY = 0;
  state.preview.drag = null;
}

function resetPreviewEditors() {
  state.hotspot.current = null;
  state.hotspot.edit = null;
  state.hotspot.moved = false;
  state.mask.current = null;
  state.mask.edit = null;
  state.mask.moved = false;
}

function getDefaultCrop(item) {
  const iw = item.img.naturalWidth;
  const ih = item.img.naturalHeight;
  return { x: 0, y: 0, w: iw, h: ih };
}

function clampCrop(crop, item) {
  const iw = item.img.naturalWidth;
  const ih = item.img.naturalHeight;
  crop.w = Math.max(20, Math.min(crop.w, iw));
  crop.h = Math.max(20, Math.min(crop.h, ih));
  crop.x = Math.max(0, Math.min(crop.x, iw - crop.w));
  crop.y = Math.max(0, Math.min(crop.y, ih - crop.h));
}

function render() {
  const item = getSelected();
  if (syncSelectionPresetOutput(item)) return;
  if (state.preview.lastSelectedId !== item?.id) {
    resetPreviewZoom();
    state.preview.lastSelectedId = item?.id || null;
  }
  if (item && state.hotspot.selectedId && !(item.hotspots || []).some(h => h.id === state.hotspot.selectedId)) {
    state.hotspot.selectedId = null;
  }
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  if (!item) {
    currentNameEl.textContent = 'No image selected';
    cropHint.style.display = 'block';
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    hotspotList.innerHTML = '';
    if (maskList) maskList.innerHTML = '';
    cropCanvas.style.backgroundImage = 'none';
    previewCanvas.style.backgroundImage = 'none';
    updateCropSizeInfo(null);
    return;
  }
  cropHint.style.display = 'none';
  currentNameEl.textContent = item.name;
  updateCropSizeInfo(item);

  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  const iw = item.img.naturalWidth;
  const ih = item.img.naturalHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const boxW = iw * scale;
  const boxH = ih * scale;
  const offsetX = (cw - boxW) / 2;
  const offsetY = (ch - boxH) / 2;

  state.display = { scale, offsetX, offsetY, boxW, boxH };

  cropCanvas.style.backgroundImage = 'none';
  cropCtx.drawImage(item.img, offsetX, offsetY, boxW, boxH);

  if (state.mode === 'crop') {
    drawCropOverlay(item);
  }
  renderPreview(item);
  renderHotspotList(item);
  renderMaskList(item);
  updatePreviewScale();
}

function drawCropOverlay(item) {
  const { scale, offsetX, offsetY } = state.display;
  const c = item.crop;
  const x = offsetX + c.x * scale;
  const y = offsetY + c.y * scale;
  const w = c.w * scale;
  const h = c.h * scale;

  cropCtx.save();
  cropCtx.fillStyle = 'rgba(0,0,0,0.45)';
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  // Darken outside the crop area without erasing the image.
  cropCtx.fillRect(0, 0, cw, y);
  cropCtx.fillRect(0, y + h, cw, ch - (y + h));
  cropCtx.fillRect(0, y, x, h);
  cropCtx.fillRect(x + w, y, cw - (x + w), h);

  cropCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  cropCtx.lineWidth = 2;
  cropCtx.strokeRect(x, y, w, h);

  const handleSize = 10;
  const handles = getHandlePoints(x, y, w, h);
  cropCtx.fillStyle = '#ff7a59';
  handles.forEach(p => {
    cropCtx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
  });
  cropCtx.restore();
}

function renderPreview(item) {
  const outW = state.output.w;
  const outH = state.output.h;
  previewCanvas.width = outW;
  previewCanvas.height = outH;
  previewCanvas.style.width = `${outW}px`;
  previewCanvas.style.height = `${outH}px`;

  previewCanvas.style.backgroundImage = 'none';
  previewCanvas.style.backgroundColor = state.output.bg;
  previewCtx.imageSmoothingEnabled = true;
  previewCtx.imageSmoothingQuality = 'high';
  drawItemToOutput(previewCtx, item, outW, outH, state.output.bg);

  if (state.mode === 'hotspot') {
    drawHotspots(item);
  } else if (state.mode === 'mask') {
    drawMaskOverlays(item);
  }
}

function getPreviewLayoutMetrics() {
  const outW = state.output.w;
  const outH = state.output.h;
  const stage = previewStage;
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = getComputedStyle(stage);
  const padLeft = parseFloat(style.paddingLeft);
  const padRight = parseFloat(style.paddingRight);
  const padTop = parseFloat(style.paddingTop);
  const padBottom = parseFloat(style.paddingBottom);
  const innerW = Math.max(0, rect.width - padLeft - padRight);
  const innerH = Math.max(0, rect.height - padTop - padBottom);
  const baseScale = Math.min(innerW / outW, innerH / outH);
  const scale = baseScale * state.preview.zoom;
  const scaledW = outW * scale;
  const scaledH = outH * scale;
  return {
    rect,
    padLeft,
    padTop,
    innerW,
    innerH,
    baseScale,
    scale,
    scaledW,
    scaledH,
  };
}

function clampPreviewPan() {
  const metrics = getPreviewLayoutMetrics();
  if (!metrics) return;
  const overflowX = Math.max(0, metrics.scaledW - metrics.innerW);
  const overflowY = Math.max(0, metrics.scaledH - metrics.innerH);
  state.preview.panX = overflowX === 0
    ? 0
    : Math.max(-overflowX / 2, Math.min(overflowX / 2, state.preview.panX));
  state.preview.panY = overflowY === 0
    ? 0
    : Math.max(-overflowY / 2, Math.min(overflowY / 2, state.preview.panY));
}

function updatePreviewScale() {
  if (!previewZoomWrap) return;
  const metrics = getPreviewLayoutMetrics();
  if (!metrics) return;
  clampPreviewPan();
  const baseOffsetX = (metrics.innerW - metrics.scaledW) / 2 + metrics.padLeft;
  const baseOffsetY = (metrics.innerH - metrics.scaledH) / 2 + metrics.padTop;
  const offsetX = baseOffsetX + state.preview.panX;
  const offsetY = baseOffsetY + state.preview.panY;
  previewZoomWrap.style.width = `${state.output.w}px`;
  previewZoomWrap.style.height = `${state.output.h}px`;
  previewZoomWrap.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${metrics.scale})`;
}

function getPreviewPointerPosition(event) {
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function hitTestHotspot(mx, my, item) {
  const list = item.hotspots || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const h = list[i];
    if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
      return { hotspot: h, index: i };
    }
  }
  return null;
}

function hitTestMask(mx, my, item) {
  const list = item.masks || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const mask = list[i];
    if (mx >= mask.x && mx <= mask.x + mask.w && my >= mask.y && my <= mask.y + mask.h) {
      return { mask, index: i };
    }
  }
  return null;
}

function getHotspotHandles(h) {
  return [
    { name: 'nw', x: h.x, y: h.y },
    { name: 'ne', x: h.x + h.w, y: h.y },
    { name: 'sw', x: h.x, y: h.y + h.h },
    { name: 'se', x: h.x + h.w, y: h.y + h.h },
  ];
}

function hitTestHotspotHandle(mx, my, h) {
  const size = 10;
  const handles = getHotspotHandles(h);
  for (const p of handles) {
    if (mx >= p.x - size && mx <= p.x + size && my >= p.y - size && my <= p.y + size) {
      return p.name;
    }
  }
  return null;
}

function drawHotspotLabel(ctx, x, y, text) {
  const diameter = 34;
  const radius = diameter / 2;
  ctx.save();
  ctx.font = '600 16px \"IBM Plex Mono\", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(11, 15, 26, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x + radius, y + radius);
  ctx.restore();
}

function drawHotspots(item) {
  const list = item.hotspots || [];
  previewCtx.save();
  previewCtx.lineWidth = 2;
  list.forEach((h, idx) => {
    const isSelected = h.id === state.hotspot.selectedId;
    previewCtx.fillStyle = isSelected ? 'rgba(45, 212, 191, 0.22)' : 'rgba(255, 122, 89, 0.2)';
    previewCtx.strokeStyle = isSelected ? 'rgba(45, 212, 191, 0.98)' : 'rgba(255, 122, 89, 0.85)';
    previewCtx.lineWidth = isSelected ? 3 : 2;
    previewCtx.fillRect(h.x, h.y, h.w, h.h);
    previewCtx.strokeRect(h.x, h.y, h.w, h.h);
    drawHotspotLabel(previewCtx, h.x + 8, h.y + 8, `${idx + 1}`);
    const handleSize = 8;
    previewCtx.fillStyle = isSelected ? 'rgba(45, 212, 191, 0.95)' : 'rgba(255, 122, 89, 0.85)';
    getHotspotHandles(h).forEach(p => {
      previewCtx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    });
  });
  if (state.hotspot.mode === 'draw' && state.hotspot.current) {
    const h = state.hotspot.current;
    previewCtx.strokeStyle = 'rgba(45, 212, 191, 0.9)';
    previewCtx.fillStyle = 'rgba(45, 212, 191, 0.25)';
    previewCtx.fillRect(h.x, h.y, h.w, h.h);
    previewCtx.strokeRect(h.x, h.y, h.w, h.h);
  }
  previewCtx.restore();
}

function drawMaskOverlays(item) {
  const list = item.masks || [];
  previewCtx.save();
  list.forEach(mask => {
    previewCtx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    previewCtx.fillRect(mask.x, mask.y, mask.w, mask.h);
    previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    previewCtx.lineWidth = 2;
    previewCtx.strokeRect(mask.x, mask.y, mask.w, mask.h);
    const handleSize = 8;
    previewCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    getHotspotHandles(mask).forEach(p => {
      previewCtx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    });
  });
  if (state.mask.mode === 'draw' && state.mask.current) {
    const mask = state.mask.current;
    previewCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    previewCtx.lineWidth = 2;
    previewCtx.fillRect(mask.x, mask.y, mask.w, mask.h);
    previewCtx.strokeRect(mask.x, mask.y, mask.w, mask.h);
  }
  previewCtx.restore();
}

function renderHotspotList(item) {
  hotspotList.innerHTML = '';
  const targets = state.items;
  if (!targets.length) return;
  item.hotspots.forEach((h, idx) => {
    const row = document.createElement('div');
    row.className = 'hotspot-item' + (h.id === state.hotspot.selectedId ? ' active' : '');

    const top = document.createElement('div');
    top.className = 'hotspot-item-top';

    const select = document.createElement('select');
    targets.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === h.targetId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      h.targetId = select.value;
      renderHotspotList(item);
    });
    select.addEventListener('click', e => e.stopPropagation());

    const label = document.createElement('div');
    label.className = 'hotspot-label';
    label.textContent = `#${idx + 1}`;

    const del = document.createElement('button');
    del.className = 'secondary';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      item.hotspots = item.hotspots.filter(x => x.id !== h.id);
      if (state.hotspot.selectedId === h.id) {
        state.hotspot.selectedId = null;
      }
      render();
    });
    del.addEventListener('click', e => e.stopPropagation());

    top.appendChild(label);
    top.appendChild(del);

    const target = targets.find(t => t.id === h.targetId) || null;
    const targetCard = document.createElement('div');
    targetCard.className = 'hotspot-target-card';
    if (target) {
      const targetThumb = document.createElement('img');
      targetThumb.className = 'hotspot-target-thumb';
      targetThumb.src = target.url;
      targetThumb.alt = target.name;
      targetThumb.addEventListener('click', e => {
        e.stopPropagation();
        state.selectedId = target.id;
        state.hotspot.selectedId = null;
        renderThumbs();
        render();
      });

      const targetInfo = document.createElement('div');
      targetInfo.className = 'hotspot-target-info';

      const targetName = document.createElement('div');
      targetName.className = 'hotspot-target-name';
      targetName.textContent = target.name;

      const targetMeta = document.createElement('div');
      targetMeta.className = 'hotspot-target-meta';
      targetMeta.textContent = 'クリックでこの画像へ移動';

      targetInfo.appendChild(targetName);
      targetInfo.appendChild(targetMeta);
      targetCard.appendChild(targetThumb);
      targetCard.appendChild(targetInfo);
    } else {
      targetCard.classList.add('is-empty');
      targetCard.textContent = '遷移先を選択してください';
    }

    row.addEventListener('click', () => {
      state.hotspot.selectedId = h.id;
      render();
    });

    row.appendChild(top);
    row.appendChild(targetCard);
    row.appendChild(select);
    hotspotList.appendChild(row);
  });
}

function renderMaskList(item) {
  if (!maskList) return;
  maskList.innerHTML = '';
  (item.masks || []).forEach((mask, idx) => {
    const row = document.createElement('div');
    row.className = 'hotspot-item';

    const top = document.createElement('div');
    top.className = 'hotspot-item-top';

    const label = document.createElement('div');
    label.className = 'hotspot-label';
    label.textContent = `#${idx + 1}`;

    const del = document.createElement('button');
    del.className = 'secondary';
    del.textContent = '削除';
    del.addEventListener('click', e => {
      e.stopPropagation();
      item.masks = item.masks.filter(x => x.id !== mask.id);
      render();
    });

    top.appendChild(label);
    top.appendChild(del);

    const info = document.createElement('div');
    info.className = 'hotspot-target-card';
    info.innerHTML = `<div class="hotspot-target-info"><div class="hotspot-target-name">黒塗りマスク</div><div class="hotspot-target-meta">${formatPxSize(mask.w, mask.h)} / x:${Math.round(mask.x)} y:${Math.round(mask.y)}</div></div>`;

    row.appendChild(top);
    row.appendChild(info);
    maskList.appendChild(row);
  });
}

function getHandlePoints(x, y, w, h) {
  return [
    { name: 'nw', x, y },
    { name: 'ne', x: x + w, y },
    { name: 'sw', x, y: y + h },
    { name: 'se', x: x + w, y: y + h },
  ];
}

function hitTestHandle(mx, my, rect) {
  const size = 12;
  const handles = getHandlePoints(rect.x, rect.y, rect.w, rect.h);
  for (const h of handles) {
    if (
      mx >= h.x - size && mx <= h.x + size &&
      my >= h.y - size && my <= h.y + size
    ) {
      return h.name;
    }
  }
  return null;
}

function updateHotspotCursor(mx, my, item) {
  if (state.preview.drag) {
    previewCanvas.style.cursor = 'grabbing';
    return;
  }
  const hit = hitTestHotspot(mx, my, item);
  if (hit) {
    const handle = hitTestHotspotHandle(mx, my, hit.hotspot);
    if (handle === 'nw' || handle === 'se') {
      previewCanvas.style.cursor = 'nwse-resize';
      return;
    }
    if (handle === 'ne' || handle === 'sw') {
      previewCanvas.style.cursor = 'nesw-resize';
      return;
    }
    previewCanvas.style.cursor = 'pointer';
    return;
  }
  previewCanvas.style.cursor = state.hotspot.mode === 'draw'
    ? HOTSPOT_CURSOR
    : (state.preview.zoom > 1 ? 'grab' : 'default');
}

function isPreviewDrawModeActive() {
  return (state.mode === 'hotspot' && state.hotspot.mode === 'draw')
    || (state.mode === 'mask' && state.mask.mode === 'draw');
}

function getPreviewIdleCursor() {
  if (state.mode === 'hotspot' && state.hotspot.mode === 'draw') return HOTSPOT_CURSOR;
  if (state.mode === 'mask' && state.mask.mode === 'draw') return 'crosshair';
  return state.preview.zoom > 1 && (state.mode === 'hotspot' || state.mode === 'mask')
    ? 'grab'
    : 'default';
}

function updateMaskCursor(mx, my, item) {
  if (state.preview.drag) {
    previewCanvas.style.cursor = 'grabbing';
    return;
  }
  const hit = hitTestMask(mx, my, item);
  if (hit) {
    const handle = hitTestHotspotHandle(mx, my, hit.mask);
    if (handle === 'nw' || handle === 'se') {
      previewCanvas.style.cursor = 'nwse-resize';
      return;
    }
    if (handle === 'ne' || handle === 'sw') {
      previewCanvas.style.cursor = 'nesw-resize';
      return;
    }
    previewCanvas.style.cursor = 'move';
    return;
  }
  previewCanvas.style.cursor = state.mask.mode === 'draw'
    ? 'crosshair'
    : (state.preview.zoom > 1 ? 'grab' : 'default');
}

function updateCropCursor(mx, my, item) {
  const cropRect = canvasRectForCrop(item);
  const handle = hitTestHandle(mx, my, cropRect);
  if (handle === 'nw' || handle === 'se') {
    cropCanvas.style.cursor = 'nwse-resize';
  } else if (handle === 'ne' || handle === 'sw') {
    cropCanvas.style.cursor = 'nesw-resize';
  } else if (
    mx >= cropRect.x && mx <= cropRect.x + cropRect.w &&
    my >= cropRect.y && my <= cropRect.y + cropRect.h
  ) {
    cropCanvas.style.cursor = 'move';
  } else {
    cropCanvas.style.cursor = 'default';
  }
}

function updateDebugHud(text) {
  if (debugHud) debugHud.textContent = text;
}

function canvasToImageCoords(mx, my) {
  const { scale, offsetX, offsetY } = state.display;
  const x = (mx - offsetX) / scale;
  const y = (my - offsetY) / scale;
  return { x, y };
}

function canvasRectForCrop(item) {
  const { scale, offsetX, offsetY } = state.display;
  const c = item.crop;
  return {
    x: offsetX + c.x * scale,
    y: offsetY + c.y * scale,
    w: c.w * scale,
    h: c.h * scale,
  };
}

cropCanvas.addEventListener('mousedown', e => {
  const item = getSelected();
  if (!item || state.mode !== 'crop') return;
  const rect = cropCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const cropRect = canvasRectForCrop(item);
  const handle = hitTestHandle(mx, my, cropRect);

  if (handle) {
    state.drag = { mode: 'resize', handle, startX: mx, startY: my, startCrop: { ...item.crop } };
  } else if (
    mx >= cropRect.x && mx <= cropRect.x + cropRect.w &&
    my >= cropRect.y && my <= cropRect.y + cropRect.h
  ) {
    state.drag = { mode: 'move', startX: mx, startY: my, startCrop: { ...item.crop } };
  }
});

window.addEventListener('mouseup', () => {
  state.drag = null;
  cropCanvas.style.cursor = 'default';
});

window.addEventListener('mousemove', e => {
  const item = getSelected();
  if (!item || state.mode !== 'crop') return;
  const rect = cropCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (!state.drag) {
    updateCropCursor(mx, my, item);
    const imgPos = canvasToImageCoords(mx, my);
    updateDebugHud(`Crop | canvas x:${mx.toFixed(0)} y:${my.toFixed(0)} | image x:${imgPos.x.toFixed(0)} y:${imgPos.y.toFixed(0)}`);
    return;
  }
  const { startX, startY, startCrop } = state.drag;
  const dx = mx - startX;
  const dy = my - startY;

  if (state.drag.mode === 'move') {
    const imgDelta = canvasToImageCoords(startX + dx, startY + dy);
    const imgStart = canvasToImageCoords(startX, startY);
    item.crop.x = startCrop.x + (imgDelta.x - imgStart.x);
    item.crop.y = startCrop.y + (imgDelta.y - imgStart.y);
    clampCrop(item.crop, item);
  } else if (state.drag.mode === 'resize') {
    let newW = startCrop.w;
    let newH = startCrop.h;
    let newX = startCrop.x;
    let newY = startCrop.y;

    const imgDelta = canvasToImageCoords(startX + dx, startY + dy);
    const imgStart = canvasToImageCoords(startX, startY);
    const ddx = imgDelta.x - imgStart.x;
    const ddy = imgDelta.y - imgStart.y;

    if (state.drag.handle === 'se') {
      newW = Math.max(20, startCrop.w + ddx);
      newH = Math.max(20, startCrop.h + ddy);
    } else if (state.drag.handle === 'sw') {
      newW = Math.max(20, startCrop.w - ddx);
      newH = Math.max(20, startCrop.h + ddy);
      newX = startCrop.x + (startCrop.w - newW);
    } else if (state.drag.handle === 'ne') {
      newW = Math.max(20, startCrop.w + ddx);
      newH = Math.max(20, startCrop.h - ddy);
      newY = startCrop.y + (startCrop.h - newH);
    } else if (state.drag.handle === 'nw') {
      newW = Math.max(20, startCrop.w - ddx);
      newH = Math.max(20, startCrop.h - ddy);
      newX = startCrop.x + (startCrop.w - newW);
      newY = startCrop.y + (startCrop.h - newH);
    }

    item.crop = { x: newX, y: newY, w: newW, h: newH };
    clampCrop(item.crop, item);
  }

  render();
});

cropCanvas.addEventListener('mouseleave', () => {
  updateDebugHud('Crop | x: - y: -');
});

addHotspotBtn.addEventListener('click', () => {
  state.hotspot.mode = state.hotspot.mode === 'draw' ? 'idle' : 'draw';
  state.mask.mode = 'idle';
  hotspotHint.textContent = state.hotspot.mode === 'draw'
    ? 'プレビュー上でドラッグして領域を作成'
    : '追加ボタンを押してからプレビュー上でドラッグ';
  if (state.mode !== 'hotspot') {
    setMode('hotspot');
  } else {
    render();
  }
});

addMaskBtn?.addEventListener('click', () => {
  state.mask.mode = state.mask.mode === 'draw' ? 'idle' : 'draw';
  state.hotspot.mode = 'idle';
  maskHint.textContent = state.mask.mode === 'draw'
    ? 'プレビュー上でドラッグして黒塗り範囲を作成'
    : '追加ボタンを押してからプレビュー上でドラッグ';
  if (state.mode !== 'mask') {
    setMode('mask');
  } else {
    render();
  }
});

previewCanvas.addEventListener('mousedown', e => {
  const item = getSelected();
  if (!item || (state.mode !== 'hotspot' && state.mode !== 'mask')) return;
  const { x: mx, y: my } = getPreviewPointerPosition(e);
  if (state.mode === 'hotspot') {
    state.hotspot.moved = false;
    const hit = hitTestHotspot(mx, my, item);
    if (hit) {
      state.hotspot.selectedId = hit.hotspot.id;
      const handle = hitTestHotspotHandle(mx, my, hit.hotspot);
      state.hotspot.edit = {
        id: hit.hotspot.id,
        handle,
        mode: handle ? 'resize' : 'move',
        startX: mx,
        startY: my,
        startRect: { ...hit.hotspot },
      };
      return;
    }
  } else {
    state.mask.moved = false;
    const hit = hitTestMask(mx, my, item);
    if (hit) {
      const handle = hitTestHotspotHandle(mx, my, hit.mask);
      state.mask.edit = {
        id: hit.mask.id,
        handle,
        mode: handle ? 'resize' : 'move',
        startX: mx,
        startY: my,
        startRect: { ...hit.mask },
      };
      return;
    }
  }
  if (state.preview.zoom > 1 && !isPreviewDrawModeActive()) {
    state.preview.drag = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: state.preview.panX,
      startPanY: state.preview.panY,
    };
    previewCanvas.style.cursor = 'grabbing';
    return;
  }
  if (state.mode === 'hotspot') {
    if (state.hotspot.mode !== 'draw') return;
    state.hotspot.selectedId = null;
    state.hotspot.startX = mx;
    state.hotspot.startY = my;
    state.hotspot.current = { x: mx, y: my, w: 0, h: 0 };
    return;
  }
  if (state.mask.mode !== 'draw') return;
  state.mask.startX = mx;
  state.mask.startY = my;
  state.mask.current = { x: mx, y: my, w: 0, h: 0 };
});

previewZoomWrap.style.transform = 'scale(1)';

function setMode(mode) {
  if (!cropStage || !previewStage || !cropControls || !hotspotControls || !maskControls) return;
  if (state.mode !== mode) {
    resetPreviewZoom();
    resetPreviewEditors();
  }
  state.mode = mode;
  const isCrop = mode === 'crop';
  const isHotspot = mode === 'hotspot';
  const isMask = mode === 'mask';
  if (centerPanel) {
    centerPanel.classList.toggle('mode-crop', isCrop);
    centerPanel.classList.toggle('mode-hotspot', isHotspot || isMask);
  }
  cropStage.classList.toggle('stage-hidden', !isCrop);
  cropControls.classList.toggle('stage-hidden', !isCrop);
  hotspotControls.classList.toggle('stage-hidden', !isHotspot);
  maskControls.classList.toggle('stage-hidden', !isMask);
  exportNote?.classList.toggle('stage-hidden', !isCrop);
  rightPanelHeader?.classList.toggle('stage-hidden', !isCrop);
  if (rightPanelTitle) {
    rightPanelTitle.textContent = isCrop ? 'Settings' : (isHotspot ? 'Hotspots' : 'Masks');
  }
  if (rightPanelMeta) {
    rightPanelMeta.textContent = isCrop ? '作業補助' : (isHotspot ? '遷移先の確認と設定' : '黒塗りマスクの確認と編集');
  }
  modeCropBtn.classList.toggle('primary', isCrop);
  modeCropBtn.classList.toggle('secondary', !isCrop);
  modeHotspotBtn.classList.toggle('primary', isHotspot);
  modeHotspotBtn.classList.toggle('secondary', !isHotspot);
  modeMaskBtn.classList.toggle('primary', isMask);
  modeMaskBtn.classList.toggle('secondary', !isMask);
  previewCanvas.style.cursor = getPreviewIdleCursor();
  render();
}

modeCropBtn.addEventListener('click', () => setMode('crop'));
modeHotspotBtn.addEventListener('click', () => setMode('hotspot'));
modeMaskBtn.addEventListener('click', () => setMode('mask'));

window.addEventListener('mousemove', e => {
  const item = getSelected();
  if (!item || (state.mode !== 'hotspot' && state.mode !== 'mask')) return;
  const { x: mx, y: my } = getPreviewPointerPosition(e);
  if (state.preview.drag) {
    state.preview.panX = state.preview.drag.startPanX + (e.clientX - state.preview.drag.startClientX);
    state.preview.panY = state.preview.drag.startPanY + (e.clientY - state.preview.drag.startClientY);
    clampPreviewPan();
    updatePreviewScale();
    return;
  }
  if (state.mode === 'hotspot' && !state.hotspot.edit && !state.hotspot.current) {
    updateHotspotCursor(mx, my, item);
    updateDebugHud(`Hotspot | output x:${mx.toFixed(0)} y:${my.toFixed(0)} | ${previewCanvas.width}x${previewCanvas.height}`);
  }
  if (state.mode === 'mask' && !state.mask.edit && !state.mask.current) {
    updateMaskCursor(mx, my, item);
    updateDebugHud(`Mask | output x:${mx.toFixed(0)} y:${my.toFixed(0)} | ${previewCanvas.width}x${previewCanvas.height}`);
  }
  if (state.mode === 'hotspot' && state.hotspot.edit) {
    const { startX, startY, startRect, handle, mode } = state.hotspot.edit;
    const dx = mx - startX;
    const dy = my - startY;
    let x = startRect.x;
    let y = startRect.y;
    let w = startRect.w;
    let h = startRect.h;

    if (mode === 'move') {
      x = startRect.x + dx;
      y = startRect.y + dy;
    } else if (mode === 'resize') {
      if (handle === 'se') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w + dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h + dy);
      } else if (handle === 'sw') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w - dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h + dy);
        x = startRect.x + (startRect.w - w);
      } else if (handle === 'ne') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w + dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h - dy);
        y = startRect.y + (startRect.h - h);
      } else if (handle === 'nw') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w - dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h - dy);
        x = startRect.x + (startRect.w - w);
        y = startRect.y + (startRect.h - h);
      }
    }

    const target = item.hotspots.find(hs => hs.id === state.hotspot.edit.id);
    if (target) {
      target.x = Math.max(0, Math.min(x, state.output.w - w));
      target.y = Math.max(0, Math.min(y, state.output.h - h));
      target.w = Math.min(w, state.output.w);
      target.h = Math.min(h, state.output.h);
      state.hotspot.moved = true;
      render();
    }
    return;
  }

  if (state.mode === 'hotspot' && state.hotspot.mode === 'draw' && state.hotspot.current) {
    const x = Math.min(state.hotspot.startX, mx);
    const y = Math.min(state.hotspot.startY, my);
    const w = Math.abs(mx - state.hotspot.startX);
    const h = Math.abs(my - state.hotspot.startY);
    state.hotspot.current = { x, y, w, h };
    render();
    return;
  }

  if (state.mode === 'mask' && state.mask.edit) {
    const { startX, startY, startRect, handle, mode } = state.mask.edit;
    const dx = mx - startX;
    const dy = my - startY;
    let x = startRect.x;
    let y = startRect.y;
    let w = startRect.w;
    let h = startRect.h;

    if (mode === 'move') {
      x = startRect.x + dx;
      y = startRect.y + dy;
    } else if (mode === 'resize') {
      if (handle === 'se') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w + dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h + dy);
      } else if (handle === 'sw') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w - dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h + dy);
        x = startRect.x + (startRect.w - w);
      } else if (handle === 'ne') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w + dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h - dy);
        y = startRect.y + (startRect.h - h);
      } else if (handle === 'nw') {
        w = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.w - dx);
        h = Math.max(MIN_INTERACTIVE_RECT_SIZE, startRect.h - dy);
        x = startRect.x + (startRect.w - w);
        y = startRect.y + (startRect.h - h);
      }
    }

    const target = item.masks.find(mask => mask.id === state.mask.edit.id);
    if (target) {
      target.x = Math.max(0, Math.min(x, state.output.w - w));
      target.y = Math.max(0, Math.min(y, state.output.h - h));
      target.w = Math.min(w, state.output.w);
      target.h = Math.min(h, state.output.h);
      state.mask.moved = true;
      render();
    }
    return;
  }

  if (state.mode === 'mask' && state.mask.mode === 'draw' && state.mask.current) {
    const x = Math.min(state.mask.startX, mx);
    const y = Math.min(state.mask.startY, my);
    const w = Math.abs(mx - state.mask.startX);
    const h = Math.abs(my - state.mask.startY);
    state.mask.current = { x, y, w, h };
    render();
  }
});

previewCanvas.addEventListener('mouseleave', () => {
  updateDebugHud(`${state.mode === 'mask' ? 'Mask' : 'Hotspot'} | x: - y: -`);
});

previewStage.addEventListener('wheel', e => {
  if (state.mode !== 'hotspot' && state.mode !== 'mask') return;
  const item = getSelected();
  if (!item) return;
  e.preventDefault();

  const metrics = getPreviewLayoutMetrics();
  if (!metrics) return;
  const nextZoom = Math.max(1, Math.min(4, state.preview.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  if (nextZoom === state.preview.zoom) return;

  const { x: outputX, y: outputY } = getPreviewPointerPosition(e);
  const pointerRelX = e.clientX - metrics.rect.left;
  const pointerRelY = e.clientY - metrics.rect.top;
  const nextScale = metrics.baseScale * nextZoom;
  const nextScaledW = state.output.w * nextScale;
  const nextScaledH = state.output.h * nextScale;
  const baseOffsetX = (metrics.innerW - nextScaledW) / 2 + metrics.padLeft;
  const baseOffsetY = (metrics.innerH - nextScaledH) / 2 + metrics.padTop;

  state.preview.zoom = nextZoom;
  state.preview.panX = pointerRelX - outputX * nextScale - baseOffsetX;
  state.preview.panY = pointerRelY - outputY * nextScale - baseOffsetY;
  clampPreviewPan();
  updatePreviewScale();
}, { passive: false });

window.addEventListener('mouseup', () => {
  const item = getSelected();
  if (!item || (state.mode !== 'hotspot' && state.mode !== 'mask')) return;
  if (state.preview.drag) {
    state.preview.drag = null;
    if (state.mode === 'hotspot') {
      updateHotspotCursor(-1, -1, item);
    } else {
      updateMaskCursor(-1, -1, item);
    }
    return;
  }
  previewCanvas.style.cursor = getPreviewIdleCursor();

  if (state.mode === 'hotspot' && state.hotspot.edit) {
    const edit = state.hotspot.edit;
    state.hotspot.edit = null;
    if (!state.hotspot.moved) {
      const target = item.hotspots.find(hs => hs.id === edit.id);
      if (target?.targetId) {
        state.selectedId = target.targetId;
        state.hotspot.selectedId = null;
        renderThumbs();
        render();
        state.hotspot.moved = false;
        return;
      }
    }
    state.hotspot.selectedId = edit.id;
    state.hotspot.moved = false;
    render();
    return;
  }

  if (state.mode === 'hotspot' && state.hotspot.mode === 'draw' && state.hotspot.current) {
    const h = state.hotspot.current;
    state.hotspot.current = null;
    if (h.w < MIN_INTERACTIVE_RECT_SIZE || h.h < MIN_INTERACTIVE_RECT_SIZE) {
      render();
      return;
    }
    const target = state.items.find(t => t.id !== item.id) || item;
    const newHotspot = {
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(h.x, state.output.w - h.w)),
      y: Math.max(0, Math.min(h.y, state.output.h - h.h)),
      w: Math.min(h.w, state.output.w),
      h: Math.min(h.h, state.output.h),
      targetId: target.id,
    };
    item.hotspots.push(newHotspot);
    state.hotspot.selectedId = newHotspot.id;
    render();
    return;
  }

  if (state.mode === 'mask' && state.mask.edit) {
    state.mask.edit = null;
    state.mask.moved = false;
    render();
    return;
  }

  if (state.mode === 'mask' && state.mask.mode === 'draw' && state.mask.current) {
    const mask = state.mask.current;
    state.mask.current = null;
    if (mask.w < MIN_INTERACTIVE_RECT_SIZE || mask.h < MIN_INTERACTIVE_RECT_SIZE) {
      render();
      return;
    }
    item.masks.push({
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(mask.x, state.output.w - mask.w)),
      y: Math.max(0, Math.min(mask.y, state.output.h - mask.h)),
      w: Math.min(mask.w, state.output.w),
      h: Math.min(mask.h, state.output.h),
    });
    render();
  }
});

resetCropBtn.addEventListener('click', () => {
  const item = getSelected();
  if (!item) return;
  item.crop = getDefaultCrop(item);
  render();
});

applyCropAllBtn.addEventListener('click', () => {
  const item = getSelected();
  if (!item) return;
  const iw = item.img.naturalWidth;
  const ih = item.img.naturalHeight;
  const c = item.crop;
  const norm = {
    x: c.x / iw,
    y: c.y / ih,
    w: c.w / iw,
    h: c.h / ih,
  };
  state.items.forEach(t => {
    const tw = t.img.naturalWidth;
    const th = t.img.naturalHeight;
    const next = {
      x: norm.x * tw,
      y: norm.y * th,
      w: norm.w * tw,
      h: norm.h * th,
    };
    t.crop = next;
    clampCrop(t.crop, t);
  });
  render();
});

bgColorInput.addEventListener('change', () => {
  state.output.bg = bgColorInput.value;
  render();
});

outputWidthInput?.addEventListener('change', () => {
  if (state.output.preset !== 'custom') return;
  const nextW = Number.parseInt(outputWidthInput.value, 10);
  const nextH = Number.parseInt(outputHeightInput?.value || '', 10);
  setOutputSize(nextW, nextH);
});

outputHeightInput?.addEventListener('change', () => {
  if (state.output.preset !== 'custom') return;
  const nextW = Number.parseInt(outputWidthInput?.value || '', 10);
  const nextH = Number.parseInt(outputHeightInput.value, 10);
  setOutputSize(nextW, nextH);
});

outputPresetSelect?.addEventListener('change', () => {
  applyOutputPreset(outputPresetSelect.value);
});

async function exportHTML() {
  if (!state.items.length) return;
  const exportW = state.output.w || 1920;
  const exportH = state.output.h || 1080;
  const bg = state.output.bg;
  const scaleX = exportW / state.output.w;
  const scaleY = exportH / state.output.h;

  const encodedImages = [];
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = exportW;
  tempCanvas.height = exportH;

  for (const item of state.items) {
    drawItemToOutput(tempCtx, item, exportW, exportH, bg);
    const dataUrl = tempCanvas.toDataURL('image/png');
    encodedImages.push({
      id: item.id,
      name: item.name,
      dataUrl,
      hotspots: (item.hotspots || []).map(h => ({
        ...h,
        x: h.x * scaleX,
        y: h.y * scaleY,
        w: h.w * scaleX,
        h: h.h * scaleY,
      })),
      masks: (item.masks || []).map(mask => ({
        ...mask,
        x: mask.x * scaleX,
        y: mask.y * scaleY,
        w: mask.w * scaleX,
        h: mask.h * scaleY,
      })),
    });
  }

  const html = buildExportHTML(encodedImages, exportW, exportH, bg);
  await saveTextFile(html, 'mock_export.html', 'text/html');
}

function buildExportHTML(items, outW, outH, bg) {
  const idToIndex = {};
  items.forEach((item, idx) => {
    idToIndex[item.id] = idx;
  });

  const itemsWithTargets = items.map(item => {
    const hotspots = (item.hotspots || [])
      .filter(h => h.targetId && idToIndex[h.targetId] !== undefined)
      .map(h => ({
        x: (h.x / outW) * 100,
        y: (h.y / outH) * 100,
        w: (h.w / outW) * 100,
        h: (h.h / outH) * 100,
        targetIdx: idToIndex[h.targetId],
      }));
    return { ...item, hotspots };
  });

  const listItems = items
    .map((item, idx) => {
      return `
        <button class="thumb" data-idx="${idx}">
          <img src="${item.dataUrl}" alt="${item.name}" />
          <span>${item.name}</span>
        </button>
      `;
    })
    .join('');

  const first = items[0];

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mock Export</title>
  <style>
    :root {
      --main-padding: 24px;
      --viewer-max-height: calc(100dvh - (var(--main-padding) * 2));
      --viewer-width-closed: calc(100vw - (var(--main-padding) * 2));
      --viewer-width-open: calc(100vw - 280px - (var(--main-padding) * 2));
    }
    body {
      margin: 0;
      font-family: 'Segoe UI', sans-serif;
      background: ${bg};
      color: #f4f4f4;
      min-height: 100dvh;
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr;
      min-height: 100dvh;
    }
    .layout.open {
      grid-template-columns: 280px 1fr;
    }
    .toggle {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 10;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.35);
      color: #fff;
      cursor: pointer;
    }
    aside {
      border-right: 1px solid rgba(255,255,255,0.1);
      padding: 16px;
      overflow-y: auto;
      background: rgba(0,0,0,0.2);
      display: none;
    }
    .layout.open aside {
      display: block;
    }
    main {
      display: grid;
      place-items: center;
      padding: var(--main-padding);
    }
    .viewer {
      max-width: 100%;
      position: relative;
      width: min(var(--viewer-width-closed), calc(var(--viewer-max-height) * ${outW / outH}), ${outW}px);
      max-height: var(--viewer-max-height);
      aspect-ratio: ${outW} / ${outH};
    }
    .layout.open .viewer {
      width: min(var(--viewer-width-open), calc(var(--viewer-max-height) * ${outW / outH}), ${outW}px);
    }
    .layout:not(.open) main {
      padding: var(--main-padding);
    }
    .layout:not(.open) .viewer {
      width: min(var(--viewer-width-closed), calc(var(--viewer-max-height) * ${outW / outH}), ${outW}px);
      max-width: 100%;
    }
    .viewer img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      display: block;
      object-fit: contain;
    }
    .hotspot-layer {
      position: absolute;
      inset: 0;
    }
    .hotspot {
      position: absolute;
      border: 1px solid rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.08);
      cursor: pointer;
    }
    .thumb {
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 12px;
      width: 100%;
      text-align: left;
      align-items: center;
      background: transparent;
      border: 1px solid transparent;
      color: inherit;
      padding: 8px;
      border-radius: 12px;
      cursor: pointer;
    }
    .thumb img {
      width: 64px;
      height: 64px;
      object-fit: cover;
      border-radius: 10px;
    }
    .thumb.active {
      border-color: rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.05);
    }
  </style>
</head>
<body>
  <button id="toggleList" class="toggle">リスト</button>
  <div id="layout" class="layout">
    <aside>
      ${listItems}
    </aside>
    <main>
      <div class="viewer">
        <img id="mainImage" src="${first.dataUrl}" alt="${first.name}" />
        <div id="hotspotLayer" class="hotspot-layer"></div>
      </div>
    </main>
  </div>
  <script>
    const items = ${JSON.stringify(itemsWithTargets)};
    const buttons = Array.from(document.querySelectorAll('.thumb'));
    const mainImage = document.getElementById('mainImage');
    const hotspotLayer = document.getElementById('hotspotLayer');
    const layout = document.getElementById('layout');
    const toggleList = document.getElementById('toggleList');

    function renderHotspots(idx) {
      hotspotLayer.innerHTML = '';
      const list = items[idx].hotspots || [];
      list.forEach(h => {
        const div = document.createElement('div');
        div.className = 'hotspot';
        div.style.left = h.x + '%';
        div.style.top = h.y + '%';
        div.style.width = h.w + '%';
        div.style.height = h.h + '%';
        div.addEventListener('click', () => {
          switchTo(h.targetIdx);
        });
        hotspotLayer.appendChild(div);
      });
    }

    function switchTo(idx) {
      mainImage.src = items[idx].dataUrl;
      buttons.forEach(b => b.classList.remove('active'));
      const btn = buttons[idx];
      if (btn) btn.classList.add('active');
      renderHotspots(idx);
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        switchTo(idx);
      });
    });
    if (buttons[0]) {
      buttons[0].classList.add('active');
      renderHotspots(0);
    }
    toggleList.addEventListener('click', () => {
      layout.classList.toggle('open');
    });
  </script>
</body>
</html>`;
}

exportBtn.addEventListener('click', exportHTML);

async function saveProject() {
  if (!state.items.length) return;
  const includeImages = saveImageMode?.value !== 'reference';
  const payload = {
    version: 1,
    embeddedImages: includeImages,
    output: { ...state.output },
    items: state.items.map(item => ({
      id: item.id,
      name: item.name,
      ...(includeImages ? { dataUrl: item.dataUrl } : {}),
      crop: item.crop,
      hotspots: item.hotspots || [],
      masks: item.masks || [],
    })),
  };
  const json = JSON.stringify(payload, null, 2);
  await saveTextFile(json, 'project.cmproj.json', 'application/json');
}

function toPngFileName(name) {
  const baseName = (name || 'image').replace(/\.[^.]+$/, '');
  return `${baseName}_cropped.png`;
}

function getUniqueFileName(fileName, usedNames) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }
  const match = fileName.match(/^(.*?)(\.[^.]+)?$/);
  const baseName = match?.[1] || fileName;
  const ext = match?.[2] || '';
  let index = 2;
  while (true) {
    const nextName = `${baseName}_${index}${ext}`;
    if (!usedNames.has(nextName)) {
      usedNames.add(nextName);
      return nextName;
    }
    index += 1;
  }
}

function canvasToBlob(canvas, mime) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(blob);
    }, mime);
  });
}

async function saveBlobFile(blob, suggestedName, mime) {
  if (window.showSaveFilePicker) {
    try {
      const ext = '.' + suggestedName.split('.').pop();
      const handle = await showSaveFilePickerWithStartIn({
        id: 'save-blob-file',
        suggestedName,
        types: [{ description: mime, accept: { [mime]: [ext] } }],
      });
      if (!handle) return;
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      state.projectLoadStartHandle = handle;
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveTextFile(text, suggestedName, mime) {
  if (window.showSaveFilePicker) {
    try {
      const ext = '.' + suggestedName.split('.').pop();
      const handle = await showSaveFilePickerWithStartIn({
        id: 'save-text-file',
        suggestedName,
        types: [{ description: mime, accept: { [mime]: [ext] } }],
      });
      if (!handle) return;
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      state.projectLoadStartHandle = handle;
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

function renderCroppedImageCanvas(item) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = Math.max(1, Math.round(state.output.w));
  tempCanvas.height = Math.max(1, Math.round(state.output.h));
  const tempCtx = tempCanvas.getContext('2d');
  drawItemToOutput(tempCtx, item, tempCanvas.width, tempCanvas.height, state.output.bg);
  return tempCanvas;
}

async function buildCroppedImageBlob(item) {
  const tempCanvas = renderCroppedImageCanvas(item);
  return canvasToBlob(tempCanvas, 'image/png');
}

async function writeBlobToDirectory(dirHandle, blob, fileName) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function ensureDirectoryWritePermission(dirHandle) {
  if (!dirHandle?.queryPermission || !dirHandle?.requestPermission) return true;
  const options = { mode: 'readwrite' };
  const current = await dirHandle.queryPermission(options);
  if (current === 'granted') return true;
  const next = await dirHandle.requestPermission(options);
  return next === 'granted';
}

async function saveCroppedImage() {
  if (!state.items.length) return;
  const usedNames = new Set();
  const croppedFiles = [];
  for (const item of state.items) {
    const blob = await buildCroppedImageBlob(item);
    croppedFiles.push({
      fileName: getUniqueFileName(toPngFileName(item.name), usedNames),
      blob,
    });
  }

  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await showDirectoryPickerWithStartIn({
        id: 'save-cropped-images',
        mode: 'readwrite',
      });
      if (!dirHandle) return;
      const hasPermission = await ensureDirectoryWritePermission(dirHandle);
      if (!hasPermission) {
        alert('選択したフォルダへの書き込み権限が許可されていません。');
        return;
      }
      for (const file of croppedFiles) {
        await writeBlobToDirectory(dirHandle, file.blob, file.fileName);
      }
      state.projectLoadStartHandle = dirHandle;
      alert(`${croppedFiles.length} 件のトリミング画像を保存しました。`);
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('Failed to save cropped images to directory:', err);
      alert('フォルダへの保存に失敗しました。個別ダウンロードに切り替えます。');
    }
  }

  for (const file of croppedFiles) {
    await saveBlobFile(file.blob, file.fileName, 'image/png');
  }
  alert(`${croppedFiles.length} 件のトリミング画像をダウンロードしました。`);
}

async function loadProjectFile(file, options = {}) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.items)) return;
  state.items = [];
  state.selectedId = null;
  if (data.output) {
    state.output.w = data.output.w || state.output.w;
    state.output.h = data.output.h || state.output.h;
    state.output.bg = data.output.bg || state.output.bg;
    state.output.preset = data.output.preset || 'custom';
    bgColorInput.value = state.output.bg;
    syncOutputInputs();
  }
  const resolvedFiles = await resolveProjectImageFiles(data.items, {
    startInHandle: options.startInHandle || null,
  });
  for (const src of data.items) {
    const fileEntry = resolvedFiles.get(src.name || '');
    const dataUrl = src.dataUrl || (fileEntry ? await fileToDataUrl(fileEntry) : null);
    if (!dataUrl) continue;
    const img = new Image();
    await new Promise(resolve => {
      img.onload = resolve;
      img.src = dataUrl;
    });
    const item = {
      id: src.id || crypto.randomUUID(),
      name: src.name || fileEntry?.name || 'image',
      file: fileEntry || null,
      url: dataUrl,
      dataUrl,
      img,
      crop: src.crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight },
      hotspots: src.hotspots || [],
      masks: src.masks || [],
    };
    state.items.push(item);
    if (!state.selectedId) state.selectedId = item.id;
  }
  if ((!data.output?.w || !data.output?.h) && state.items[0]) {
    state.output.w = state.items[0].img.naturalWidth;
    state.output.h = state.items[0].img.naturalHeight;
    state.output.preset = 'selection';
    syncOutputInputs();
  }
  renderThumbs();
  resizeCropCanvas();
  updatePreviewScale();
  render();
}

saveProjectBtn.addEventListener('click', saveProject);
saveCroppedImageBtn.addEventListener('click', saveCroppedImage);

function shouldRetryPickerWithoutStartIn(err) {
  return err && (err.name === 'TypeError' || err.name === 'NotAllowedError');
}

async function showSaveFilePickerWithStartIn(options) {
  if (!window.showSaveFilePicker) return null;
  const pickerOptions = { ...options };
  if (state.projectLoadStartHandle) {
    pickerOptions.startIn = state.projectLoadStartHandle;
  }
  try {
    return await window.showSaveFilePicker(pickerOptions);
  } catch (err) {
    if (!pickerOptions.startIn || !shouldRetryPickerWithoutStartIn(err)) throw err;
    delete pickerOptions.startIn;
    return await window.showSaveFilePicker(pickerOptions);
  }
}

async function showDirectoryPickerWithStartIn(options = {}) {
  if (!window.showDirectoryPicker) return null;
  const pickerOptions = { ...options };
  if (state.projectLoadStartHandle) {
    pickerOptions.startIn = state.projectLoadStartHandle;
  }
  try {
    return await window.showDirectoryPicker(pickerOptions);
  } catch (err) {
    if (!pickerOptions.startIn || !shouldRetryPickerWithoutStartIn(err)) throw err;
    delete pickerOptions.startIn;
    return await window.showDirectoryPicker(pickerOptions);
  }
}

async function pickProjectFile() {
  if (!window.showOpenFilePicker) {
    loadProjectInput.click();
    return null;
  }

  try {
    const pickerOptions = {
      id: 'project-load',
      types: [{
        description: 'Project JSON',
        accept: { 'application/json': ['.json', '.cmproj.json'] },
      }],
    };
    if (state.projectLoadStartHandle) {
      pickerOptions.startIn = state.projectLoadStartHandle;
    }
    let handles;
    try {
      handles = await window.showOpenFilePicker(pickerOptions);
    } catch (err) {
      if (!pickerOptions.startIn || !shouldRetryPickerWithoutStartIn(err)) throw err;
      delete pickerOptions.startIn;
      handles = await window.showOpenFilePicker(pickerOptions);
    }
    const [handle] = handles;
    if (!handle) return null;
    const file = await handle.getFile();
    state.projectLoadStartHandle = handle;
    return { file, startInHandle: handle };
  } catch (err) {
    if (err && err.name === 'AbortError') return null;
    throw err;
  }
}

async function openProjectLoadDialog() {
  const picked = await pickProjectFile();
  if (!picked) return;
  await loadProjectFile(picked.file, { startInHandle: picked.startInHandle });
}

loadProjectBtn.addEventListener('click', () => {
  openProjectLoadDialog().catch(err => {
    console.error('Failed to load project:', err);
    alert('プロジェクトの読込に失敗しました。');
  });
});

loadProjectInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  loadProjectFile(file).catch(err => {
    console.error('Failed to load project:', err);
    alert('プロジェクトの読込に失敗しました。');
  });
  e.target.value = '';
});

function resizeCropCanvas() {
  const stageRect = cropStage.getBoundingClientRect();
  if (stageRect.width === 0 || stageRect.height === 0) return;
  const ratio = getOutputRatio();
  const stageStyle = getComputedStyle(cropStage);
  const innerW = Math.max(0, stageRect.width - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight));
  const innerH = Math.max(0, stageRect.height - parseFloat(stageStyle.paddingTop) - parseFloat(stageStyle.paddingBottom));
  if (innerW === 0 || innerH === 0) return;
  const cssW = Math.min(innerW, innerH * ratio);
  const cssH = cssW / ratio;
  const dpr = window.devicePixelRatio || 1;
  cropCanvas.style.width = `${cssW}px`;
  cropCanvas.style.height = `${cssH}px`;
  cropCanvas.width = Math.max(1, Math.floor(cssW * dpr));
  cropCanvas.height = Math.max(1, Math.floor(cssH * dpr));
  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = 'high';
  render();
}

window.addEventListener('resize', resizeCropCanvas);
window.addEventListener('resize', updatePreviewScale);

function resetAllCrops() {
  state.items.forEach(item => {
    item.crop = getDefaultCrop(item);
  });
}

async function resolveProjectImageFiles(items, options = {}) {
  const needsResolve = items.some(src => !src.dataUrl);
  const map = new Map();
  if (!needsResolve) return map;

  const files = await pickImageDirectoryFiles(options.startInHandle || null);
  if (!files.length) return map;

  files.forEach(file => {
    if (!map.has(file.name)) {
      map.set(file.name, file);
    }
  });

  const missing = items
    .map(src => src.name)
    .filter(name => name && !map.has(name));
  if (missing.length) {
    alert(`一部の画像が見つかりませんでした。\\n見つからない: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
  }
  return map;
}

async function pickImageDirectoryFiles(startInHandle = null) {
  if (window.showDirectoryPicker) {
    try {
      const pickerOptions = { id: 'project-image-directory' };
      if (startInHandle) {
        pickerOptions.startIn = startInHandle;
      }
      let dir;
      try {
        dir = await window.showDirectoryPicker(pickerOptions);
      } catch (err) {
        if (!pickerOptions.startIn || !shouldRetryPickerWithoutStartIn(err)) throw err;
        delete pickerOptions.startIn;
        dir = await window.showDirectoryPicker(pickerOptions);
      }
      const collected = [];
      await collectFilesFromHandle(dir, collected);
      state.projectLoadStartHandle = dir;
      return collected.filter(f => f.type.startsWith('image/'));
    } catch (err) {
      if (err && err.name === 'AbortError') return [];
    }
  }
  return await pickFilesWithDirectoryInput();
}

async function collectFilesFromHandle(handle, out) {
  if (handle.kind === 'file') {
    const file = await handle.getFile();
    out.push(file);
    return;
  }
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      out.push(file);
    } else if (entry.kind === 'directory') {
      await collectFilesFromHandle(entry, out);
    }
  }
}

function pickFilesWithDirectoryInput() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []).filter(f => f.type.startsWith('image/'));
      resolve(files);
    });
    input.click();
  });
}

syncOutputInputs();
resizeCropCanvas();
window.addEventListener('load', () => {
  requestAnimationFrame(resizeCropCanvas);
  setMode('crop');
  updatePreviewScale();
});
render();
