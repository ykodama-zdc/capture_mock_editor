const fileInput = document.getElementById('fileInput');
const fileInputSingle = document.getElementById('fileInputSingle');
const saveProjectBtn = document.getElementById('saveProject');
const loadProjectInput = document.getElementById('loadProject');
const thumbsEl = document.getElementById('thumbs');
const imageCountEl = document.getElementById('imageCount');
const currentNameEl = document.getElementById('currentName');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const previewZoomWrap = document.getElementById('previewZoomWrap');
const bgColorInput = document.getElementById('bgColor');
const resetCropBtn = document.getElementById('resetCrop');
const applyCropAllBtn = document.getElementById('applyCropAll');
const exportBtn = document.getElementById('exportBtn');
const cropHint = document.getElementById('cropHint');
const addHotspotBtn = document.getElementById('addHotspot');
const hotspotList = document.getElementById('hotspotList');
const hotspotHint = document.getElementById('hotspotHint');
const modeCropBtn = document.getElementById('modeCrop');
const modeHotspotBtn = document.getElementById('modeHotspot');
const cropStage = document.getElementById('cropStage');
const previewStage = document.getElementById('previewStage');
const cropControls = document.getElementById('cropControls');
const hotspotControls = document.getElementById('hotspotControls');
const centerPanel = document.getElementById('centerPanel');
const debugHud = document.getElementById('debugHud');

const state = {
  items: [],
  selectedId: null,
  output: {
    w: 1920,
    h: 1080,
    bg: '#0b0f1a',
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
  },
  mode: 'crop',
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
      const item = {
        id: crypto.randomUUID(),
        name: file.name,
        file,
        url: dataUrl,
        dataUrl,
        img,
        crop: null,
        hotspots: [],
      };
      item.crop = getDefaultCrop(item);
      state.items.push(item);
      if (!state.selectedId) {
        state.selectedId = item.id;
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
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  if (!item) {
    currentNameEl.textContent = 'No image selected';
    cropHint.style.display = 'block';
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    hotspotList.innerHTML = '';
    cropCanvas.style.backgroundImage = 'none';
    previewCanvas.style.backgroundImage = 'none';
    return;
  }
  cropHint.style.display = 'none';
  currentNameEl.textContent = item.name;

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
  const c = item.crop;
  const outW = state.output.w;
  const outH = state.output.h;
  previewCanvas.width = outW;
  previewCanvas.height = outH;

  previewCanvas.style.backgroundImage = 'none';
  previewCanvas.style.backgroundColor = state.output.bg;
  previewCtx.fillStyle = state.output.bg;
  previewCtx.fillRect(0, 0, outW, outH);
  previewCtx.drawImage(item.img, c.x, c.y, c.w, c.h, 0, 0, outW, outH);

  if (state.mode === 'hotspot') {
    drawHotspots(item);
  }
}

function updatePreviewScale() {
  const outW = state.output.w;
  const outH = state.output.h;
  const stage = previewStage;
  if (!stage || !previewZoomWrap) return;
  const rect = stage.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const style = getComputedStyle(stage);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const innerW = Math.max(0, rect.width - padX);
  const innerH = Math.max(0, rect.height - padY);
  const scale = Math.min(innerW / outW, innerH / outH);
  const scaledW = outW * scale;
  const scaledH = outH * scale;
  const offsetX = (innerW - scaledW) / 2 + parseFloat(style.paddingLeft);
  const offsetY = (innerH - scaledH) / 2 + parseFloat(style.paddingTop);
  previewZoomWrap.style.width = `${outW}px`;
  previewZoomWrap.style.height = `${outH}px`;
  previewZoomWrap.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
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

function drawHotspots(item) {
  const list = item.hotspots || [];
  previewCtx.save();
  previewCtx.strokeStyle = 'rgba(255, 122, 89, 0.9)';
  previewCtx.lineWidth = 2;
  previewCtx.fillStyle = 'rgba(255, 122, 89, 0.2)';
  list.forEach((h, idx) => {
    previewCtx.fillRect(h.x, h.y, h.w, h.h);
    previewCtx.strokeRect(h.x, h.y, h.w, h.h);
    previewCtx.fillStyle = 'rgba(255, 122, 89, 0.85)';
    previewCtx.font = '12px "IBM Plex Mono", monospace';
    previewCtx.fillText(`${idx + 1}`, h.x + 6, h.y + 16);
    const handleSize = 8;
    previewCtx.fillStyle = 'rgba(255, 122, 89, 0.85)';
    getHotspotHandles(h).forEach(p => {
      previewCtx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    });
    previewCtx.fillStyle = 'rgba(255, 122, 89, 0.2)';
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

function renderHotspotList(item) {
  hotspotList.innerHTML = '';
  const targets = state.items;
  if (!targets.length) return;
  item.hotspots.forEach((h, idx) => {
    const row = document.createElement('div');
    row.className = 'hotspot-item';

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
      render();
    });
    del.addEventListener('click', e => e.stopPropagation());

    row.addEventListener('click', () => {
      if (h.targetId) {
        state.selectedId = h.targetId;
        renderThumbs();
        render();
      }
    });

    row.appendChild(label);
    row.appendChild(select);
    row.appendChild(del);
    hotspotList.appendChild(row);
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
  previewCanvas.style.cursor = state.hotspot.mode === 'draw' ? 'crosshair' : 'default';
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
  hotspotHint.textContent = state.hotspot.mode === 'draw'
    ? 'プレビュー上でドラッグして領域を作成'
    : '追加ボタンを押してからプレビュー上でドラッグ';
  if (state.mode !== 'hotspot') {
    setMode('hotspot');
  }
});

previewCanvas.addEventListener('mousedown', e => {
  const item = getSelected();
  if (!item || state.mode !== 'hotspot') return;
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  state.hotspot.moved = false;
  const hit = hitTestHotspot(mx, my, item);
  if (hit) {
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
  if (state.hotspot.mode !== 'draw') return;
  state.hotspot.startX = mx;
  state.hotspot.startY = my;
  state.hotspot.current = { x: mx, y: my, w: 0, h: 0 };
});

previewZoomWrap.style.transform = 'scale(1)';

function setMode(mode) {
  if (!cropStage || !previewStage || !cropControls || !hotspotControls) return;
  state.mode = mode;
  const isCrop = mode === 'crop';
  if (centerPanel) {
    centerPanel.classList.toggle('mode-crop', isCrop);
    centerPanel.classList.toggle('mode-hotspot', !isCrop);
  }
  cropStage.classList.toggle('stage-hidden', !isCrop);
  cropControls.classList.toggle('stage-hidden', !isCrop);
  hotspotControls.classList.toggle('stage-hidden', isCrop);
  modeCropBtn.classList.toggle('primary', isCrop);
  modeCropBtn.classList.toggle('secondary', !isCrop);
  modeHotspotBtn.classList.toggle('primary', !isCrop);
  modeHotspotBtn.classList.toggle('secondary', isCrop);
  previewCanvas.style.cursor = state.hotspot.mode === 'draw' ? 'crosshair' : 'default';
  render();
}

modeCropBtn.addEventListener('click', () => setMode('crop'));
modeHotspotBtn.addEventListener('click', () => setMode('hotspot'));

window.addEventListener('mousemove', e => {
  const item = getSelected();
  if (!item || state.mode !== 'hotspot') return;
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  if (!state.hotspot.edit && !state.hotspot.current) {
    updateHotspotCursor(mx, my, item);
    updateDebugHud(`Hotspot | output x:${mx.toFixed(0)} y:${my.toFixed(0)} | ${previewCanvas.width}x${previewCanvas.height}`);
  }
  if (state.hotspot.edit) {
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
        w = Math.max(8, startRect.w + dx);
        h = Math.max(8, startRect.h + dy);
      } else if (handle === 'sw') {
        w = Math.max(8, startRect.w - dx);
        h = Math.max(8, startRect.h + dy);
        x = startRect.x + (startRect.w - w);
      } else if (handle === 'ne') {
        w = Math.max(8, startRect.w + dx);
        h = Math.max(8, startRect.h - dy);
        y = startRect.y + (startRect.h - h);
      } else if (handle === 'nw') {
        w = Math.max(8, startRect.w - dx);
        h = Math.max(8, startRect.h - dy);
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

  if (state.hotspot.mode === 'draw' && state.hotspot.current) {
    const x = Math.min(state.hotspot.startX, mx);
    const y = Math.min(state.hotspot.startY, my);
    const w = Math.abs(mx - state.hotspot.startX);
    const h = Math.abs(my - state.hotspot.startY);
    state.hotspot.current = { x, y, w, h };
    render();
  }
});

previewCanvas.addEventListener('mouseleave', () => {
  updateDebugHud('Hotspot | x: - y: -');
});

window.addEventListener('mouseup', () => {
  const item = getSelected();
  if (!item || state.mode !== 'hotspot') return;
  previewCanvas.style.cursor = state.hotspot.mode === 'draw' ? 'crosshair' : 'default';

  if (state.hotspot.edit) {
    const edit = state.hotspot.edit;
    state.hotspot.edit = null;
    if (!state.hotspot.moved) {
      const target = item.hotspots.find(hs => hs.id === edit.id);
      if (target && target.targetId) {
        state.selectedId = target.targetId;
        renderThumbs();
      }
    }
    state.hotspot.moved = false;
    render();
    return;
  }

  if (state.hotspot.mode === 'draw' && state.hotspot.current) {
    const h = state.hotspot.current;
    state.hotspot.current = null;
    if (h.w < 8 || h.h < 8) {
      render();
      return;
    }
    const target = state.items.find(t => t.id !== item.id) || item;
    item.hotspots.push({
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(h.x, state.output.w - h.w)),
      y: Math.max(0, Math.min(h.y, state.output.h - h.h)),
      w: Math.min(h.w, state.output.w),
      h: Math.min(h.h, state.output.h),
      targetId: target.id,
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

async function exportHTML() {
  if (!state.items.length) return;
  const exportW = 1920;
  const exportH = 1080;
  const bg = state.output.bg;
  const scaleX = exportW / state.output.w;
  const scaleY = exportH / state.output.h;

  const encodedImages = [];
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = exportW;
  tempCanvas.height = exportH;

  for (const item of state.items) {
    tempCtx.fillStyle = bg;
    tempCtx.fillRect(0, 0, exportW, exportH);
    const c = item.crop;
    tempCtx.drawImage(item.img, c.x, c.y, c.w, c.h, 0, 0, exportW, exportH);
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
    body {
      margin: 0;
      font-family: 'Segoe UI', sans-serif;
      background: ${bg};
      color: #f4f4f4;
      min-height: 100vh;
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr;
      min-height: 100vh;
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
      padding: 24px;
    }
    .viewer {
      max-width: 100%;
      position: relative;
      width: min(100vw, calc(100vh * ${outW / outH}), ${outW}px);
      aspect-ratio: ${outW} / ${outH};
    }
    .layout.open .viewer {
      width: min(calc(100vw - 360px), calc(100vh * ${outW / outH}), ${outW * 0.85}px);
    }
    .layout:not(.open) main {
      padding: 24px;
    }
    .layout:not(.open) .viewer {
      width: min(calc(100vw - 48px), calc(100vh * ${outW / outH}), ${outW * 0.92}px);
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
  for (const item of state.items) {
    if (!item.dataUrl && item.file) {
      try {
        item.dataUrl = await fileToDataUrl(item.file);
      } catch {
        item.dataUrl = item.url;
      }
    }
  }
  const payload = {
    version: 1,
    output: { ...state.output },
      items: state.items.map(item => ({
        id: item.id,
        name: item.name,
        dataUrl: item.dataUrl || item.url,
        crop: item.crop,
        hotspots: item.hotspots || [],
      })),
  };
  const json = JSON.stringify(payload, null, 2);
  await saveTextFile(json, 'project.cmproj.json', 'application/json');
}

async function saveTextFile(text, suggestedName, mime) {
  if (window.showSaveFilePicker) {
    try {
      const ext = '.' + suggestedName.split('.').pop();
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: mime, accept: { [mime]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
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

async function loadProjectFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.items)) return;
  state.items = [];
  state.selectedId = null;
  if (data.output) {
    state.output.bg = data.output.bg || state.output.bg;
    bgColorInput.value = state.output.bg;
  }
  for (const src of data.items) {
    if (!src.dataUrl) continue;
    const img = new Image();
    await new Promise(resolve => {
      img.onload = resolve;
      img.src = src.dataUrl;
    });
    const item = {
      id: src.id || crypto.randomUUID(),
      name: src.name || 'image',
      url: src.dataUrl,
      dataUrl: src.dataUrl,
      img,
      crop: src.crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight },
      hotspots: src.hotspots || [],
    };
    state.items.push(item);
    if (!state.selectedId) state.selectedId = item.id;
  }
  renderThumbs();
  resizeCropCanvas();
  updatePreviewScale();
  render();
}

saveProjectBtn.addEventListener('click', saveProject);
loadProjectInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  loadProjectFile(file);
  e.target.value = '';
});

function resizeCropCanvas() {
  const rect = cropCanvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const ratio = getOutputRatio();
  cropCanvas.width = Math.floor(rect.width * window.devicePixelRatio);
  cropCanvas.height = Math.floor((rect.width / ratio) * window.devicePixelRatio);
  render();
}

window.addEventListener('resize', resizeCropCanvas);
window.addEventListener('resize', updatePreviewScale);

function resetAllCrops() {
  state.items.forEach(item => {
    item.crop = getDefaultCrop(item);
  });
}


resizeCropCanvas();
window.addEventListener('load', () => {
  requestAnimationFrame(resizeCropCanvas);
  setMode('crop');
  updatePreviewScale();
});
render();
