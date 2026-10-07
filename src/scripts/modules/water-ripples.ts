// Фоновое изображение, по которому бежит рябь. Рисуется заново на canvas, исходный <img> под ним прячется
const IMAGE_SELECTOR = '[data-animated-background]';
// Зоны, где фото ничего не закрывает: курсор над ними вызывает рябь. Над остальным рябь не появляется
const ZONE_SELECTOR = '[data-support-block]';
const REVEAL_ATTRIBUTE = 'data-reveal-image';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const CONFIG = {
  resolution: 384,
  dropRadius: 22,
  moveStrength: 0.014,
  clickStrength: 0.11,
  perturbance: 0.004,
  damping: 0.989,
  waveSpeed: 1.35,
  moveThreshold: 16,
  moveInterval: 24,
};

// Волны считаются, только пока они заметны: после последней капли они затухают за это время,
// и расчёт останавливается, а на экране остаётся последний кадр. Без этого GPU работал бы вхолостую
const ACTIVE_TIME = 6000;
const CLICK_RADIUS_SCALE = 1.5;
const VELOCITY_DISTANCE = 50;
const VELOCITY_LIMIT = 1.2;
const VELOCITY_BASE = 0.8;
const VELOCITY_SHARE = 0.2;

// WebGL снимает привязку объекта через null
// eslint-disable-next-line unicorn/no-null -- единственное место, где нужен null
const UNBIND = null;

const COMMON_VERTEX_SHADER = `
  attribute vec2 vertex;
  varying vec2 coord;

  void main() {
    coord = vertex * 0.5 + 0.5;
    gl_Position = vec4(vertex, 0.0, 1.0);
  }
`;

const DROP_FRAGMENT_SHADER = `
  precision highp float;

  const float PI = 3.141592653589793;

  uniform sampler2D texture;
  uniform vec2 center;
  uniform float radius;
  uniform float strength;

  varying vec2 coord;

  void main() {
    vec4 info = texture2D(texture, coord);

    float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);

    drop = 0.5 - cos(drop * PI) * 0.5;

    info.r += drop * strength;

    gl_FragColor = info;
  }
`;

const UPDATE_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D texture;
  uniform vec2 delta;
  uniform float damping;
  uniform float waveSpeed;

  varying vec2 coord;

  void main() {
    vec4 info = texture2D(texture, coord);

    vec2 dx = vec2(delta.x, 0.0);
    vec2 dy = vec2(0.0, delta.y);

    float average = (
      texture2D(texture, coord - dx).r +
      texture2D(texture, coord - dy).r +
      texture2D(texture, coord + dx).r +
      texture2D(texture, coord + dy).r
    ) * 0.25;

    info.g += (average - info.r) * waveSpeed;
    info.g *= damping;
    info.r += info.g;

    gl_FragColor = info;
  }
`;

const RENDER_VERTEX_SHADER = `
  precision highp float;

  attribute vec2 vertex;

  uniform vec2 containerRatio;

  varying vec2 ripplesCoord;
  varying vec2 backgroundCoord;

  void main() {
    backgroundCoord = vertex * 0.5 + 0.5;
    backgroundCoord.y = 1.0 - backgroundCoord.y;

    ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;

    gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);
  }
`;

// Рябь смещает точку выборки из фона. Фон выводится как object-fit: cover: coverScale и coverOffset
// выбирают из текстуры ту часть изображения, которую видно в кадре
const RENDER_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D samplerBackground;
  uniform sampler2D samplerRipples;

  uniform vec2 delta;
  uniform float perturbance;
  uniform vec2 coverScale;
  uniform vec2 coverOffset;

  varying vec2 ripplesCoord;
  varying vec2 backgroundCoord;

  void main() {
    float height = texture2D(samplerRipples, ripplesCoord).r;
    float heightX = texture2D(samplerRipples, vec2(ripplesCoord.x + delta.x, ripplesCoord.y)).r;
    float heightY = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y + delta.y)).r;

    vec3 dx = vec3(delta.x, heightX - height, 0.0);
    vec3 dy = vec3(0.0, heightY - height, delta.y);

    vec2 offset = -normalize(cross(dy, dx)).xz;
    vec2 coord = backgroundCoord + offset * perturbance;

    gl_FragColor = texture2D(samplerBackground, coverOffset + coord * coverScale);
  }
`;

const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);

interface Ripple {
  move: (event: PointerEvent) => void;
  press: (event: PointerEvent) => void;
  leave: () => void;
}

const createShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | undefined => {
  const shader = gl.createShader(type);

  if (!shader) {
    return undefined;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);

    return undefined;
  }

  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | undefined => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!vertexShader || !fragmentShader || !program) {
    return undefined;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);

    return undefined;
  }

  return program;
};

const parsePercent = (value: string | undefined): number =>
  value?.endsWith('%') ? Number(value.slice(0, -1)) / 100 : 0.5;

// object-position фона в долях: у «center bottom» это 0.5 по горизонтали и 1 по вертикали
const readObjectPosition = (image: HTMLImageElement): [number, number] => {
  const [horizontal, vertical] = getComputedStyle(image).objectPosition.split(' ', 2);

  return [parsePercent(horizontal), parsePercent(vertical)];
};

/**
 * Волны на canvas поверх фонового изображения. Возвращает управление рябью
 * или ничего, если WebGL или нужные для волн возможности недоступны (тогда остаётся обычное фото).
 */
const createRipple = (image: HTMLImageElement): Ripple | undefined => {
  const canvas = document.createElement('canvas');

  canvas.setAttribute('aria-hidden', 'true');
  // Появление фона при загрузке страницы (reveal.ts) должно двигать и canvas
  canvas.setAttribute(REVEAL_ATTRIBUTE, '');

  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
    zIndex: getComputedStyle(image).zIndex,
  });

  image.after(canvas);

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });
  const hasFloat = gl?.getExtension('OES_texture_float');

  if (!gl || !hasFloat) {
    canvas.remove();

    return undefined;
  }

  const filter = gl.getExtension('OES_texture_float_linear') ? gl.LINEAR : gl.NEAREST;
  const size = CONFIG.resolution;
  const textureDelta = new Float32Array([1 / size, 1 / size]);

  // Две текстуры «высота и скорость воды»: из одной читаем, в другую пишем, затем меняем местами
  const rippleTextures: WebGLTexture[] = [];
  const rippleFramebuffers: WebGLFramebuffer[] = [];

  for (let index = 0; index < 2; index += 1) {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      size,
      size,
      0,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array(size * size * 4),
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Не каждая видеокарта умеет рисовать в float-текстуру: тогда рябь не включаем
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      canvas.remove();

      return undefined;
    }

    rippleTextures.push(texture);
    rippleFramebuffers.push(framebuffer);
  }

  gl.bindTexture(gl.TEXTURE_2D, UNBIND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, UNBIND);

  const dropProgram = createProgram(gl, COMMON_VERTEX_SHADER, DROP_FRAGMENT_SHADER);
  const updateProgram = createProgram(gl, COMMON_VERTEX_SHADER, UPDATE_FRAGMENT_SHADER);
  const renderProgram = createProgram(gl, RENDER_VERTEX_SHADER, RENDER_FRAGMENT_SHADER);

  if (!dropProgram || !updateProgram || !renderProgram) {
    canvas.remove();

    return undefined;
  }

  const dropLocations = {
    vertex: gl.getAttribLocation(dropProgram, 'vertex'),
    texture: gl.getUniformLocation(dropProgram, 'texture'),
    center: gl.getUniformLocation(dropProgram, 'center'),
    radius: gl.getUniformLocation(dropProgram, 'radius'),
    strength: gl.getUniformLocation(dropProgram, 'strength'),
  };

  const updateLocations = {
    vertex: gl.getAttribLocation(updateProgram, 'vertex'),
    texture: gl.getUniformLocation(updateProgram, 'texture'),
    delta: gl.getUniformLocation(updateProgram, 'delta'),
    damping: gl.getUniformLocation(updateProgram, 'damping'),
    waveSpeed: gl.getUniformLocation(updateProgram, 'waveSpeed'),
  };

  const renderLocations = {
    vertex: gl.getAttribLocation(renderProgram, 'vertex'),
    containerRatio: gl.getUniformLocation(renderProgram, 'containerRatio'),
    background: gl.getUniformLocation(renderProgram, 'samplerBackground'),
    ripples: gl.getUniformLocation(renderProgram, 'samplerRipples'),
    delta: gl.getUniformLocation(renderProgram, 'delta'),
    perturbance: gl.getUniformLocation(renderProgram, 'perturbance'),
    coverScale: gl.getUniformLocation(renderProgram, 'coverScale'),
    coverOffset: gl.getUniformLocation(renderProgram, 'coverOffset'),
  };

  const quadBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

  const backgroundTexture = gl.createTexture();

  let readIndex = 0;
  let writeIndex = 1;
  let width = 0;
  let height = 0;
  let isReady = false;
  let isRunning = false;
  let activeUntil = 0;
  let lastPointerX: number | undefined;
  let lastPointerY: number | undefined;
  let lastMoveTime = 0;

  const drawQuad = (attribute: number): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  };

  const swapBuffers = (): void => {
    [readIndex, writeIndex] = [writeIndex, readIndex];
  };

  const dropInto = (x: number, y: number, radius: number, strength: number): void => {
    const longestSide = Math.max(width, height);
    const position = new Float32Array([
      (2 * x - width) / longestSide,
      (height - 2 * y) / longestSide,
    ]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, rippleFramebuffers[writeIndex] ?? UNBIND);
    gl.viewport(0, 0, size, size);
    gl.useProgram(dropProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rippleTextures[readIndex] ?? UNBIND);
    gl.uniform1i(dropLocations.texture, 0);
    gl.uniform2fv(dropLocations.center, position);
    gl.uniform1f(dropLocations.radius, radius / longestSide);
    gl.uniform1f(dropLocations.strength, strength);
    drawQuad(dropLocations.vertex);
    swapBuffers();
  };

  const updateWaves = (): void => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rippleFramebuffers[writeIndex] ?? UNBIND);
    gl.viewport(0, 0, size, size);
    gl.useProgram(updateProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rippleTextures[readIndex] ?? UNBIND);
    gl.uniform1i(updateLocations.texture, 0);
    gl.uniform2fv(updateLocations.delta, textureDelta);
    gl.uniform1f(updateLocations.damping, CONFIG.damping);
    gl.uniform1f(updateLocations.waveSpeed, CONFIG.waveSpeed);
    drawQuad(updateLocations.vertex);
    swapBuffers();
  };

  // Какую часть изображения видно при object-fit: cover и object-position фона
  const updateCover = (): void => {
    const canvasAspect = width / height;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const isWider = canvasAspect > imageAspect;
    const scaleX = isWider ? 1 : canvasAspect / imageAspect;
    const scaleY = isWider ? imageAspect / canvasAspect : 1;
    const [positionX, positionY] = readObjectPosition(image);

    gl.useProgram(renderProgram);
    gl.uniform2f(renderLocations.coverScale, scaleX, scaleY);
    gl.uniform2f(
      renderLocations.coverOffset,
      (1 - scaleX) * positionX,
      (1 - scaleY) * (1 - positionY),
    );
  };

  const render = (): void => {
    if (!isReady || width === 0 || height === 0) {
      return;
    }

    const maxSide = Math.max(width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, UNBIND);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProgram);
    gl.uniform2fv(
      renderLocations.containerRatio,
      new Float32Array([width / maxSide, height / maxSide]),
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.uniform1i(renderLocations.background, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, rippleTextures[readIndex] ?? UNBIND);
    gl.uniform1i(renderLocations.ripples, 1);
    gl.uniform2fv(renderLocations.delta, textureDelta);
    gl.uniform1f(renderLocations.perturbance, CONFIG.perturbance);
    drawQuad(renderLocations.vertex);
    gl.disable(gl.BLEND);
  };

  const frame = (): void => {
    if (performance.now() > activeUntil) {
      isRunning = false;

      return;
    }

    updateWaves();
    render();
    requestAnimationFrame(frame);
  };

  // Волны появились или усилились: считаем кадры, пока они не затухнут
  const wake = (): void => {
    activeUntil = performance.now() + ACTIVE_TIME;

    if (!isRunning) {
      isRunning = true;
      requestAnimationFrame(frame);
    }
  };

  const resize = (): void => {
    const nextWidth = image.clientWidth;
    const nextHeight = image.clientHeight;

    if (!nextWidth || !nextHeight) {
      return;
    }

    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;

    if (isReady) {
      updateCover();
      // При смене размера canvas очищается: рисуем кадр заново
      render();
    }
  };

  // Точка под курсором в пикселях canvas. Рябь появляется только там, где canvas лежит под курсором;
  // размер берётся из прямоугольника с запасом на масштаб (при появлении фон слегка увеличен)
  const toCanvasPoint = (event: PointerEvent): { x: number; y: number } | undefined => {
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return undefined;
    }

    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;

    return x < 0 || y < 0 || x > width || y > height ? undefined : { x, y };
  };

  const startBackground = (): void => {
    if (
      image.naturalWidth === 0 ||
      image.naturalWidth > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
      image.naturalHeight > gl.getParameter(gl.MAX_TEXTURE_SIZE)
    ) {
      canvas.remove();

      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    isReady = true;
    resize();
    render();

    // Первый кадр canvas уже на экране, исходное изображение больше не нужно
    image.style.visibility = 'hidden';
  };

  if (image.complete) {
    startBackground();
  } else {
    image.addEventListener('load', startBackground, { once: true });
  }

  new ResizeObserver(resize).observe(image);

  const move = (event: PointerEvent): void => {
    const point = toCanvasPoint(event);

    if (!isReady || !point) {
      return;
    }

    const now = performance.now();

    if (now - lastMoveTime < CONFIG.moveInterval) {
      return;
    }

    if (lastPointerX === undefined || lastPointerY === undefined) {
      lastPointerX = point.x;
      lastPointerY = point.y;
      lastMoveTime = now;

      return;
    }

    const distance = Math.hypot(point.x - lastPointerX, point.y - lastPointerY);

    if (distance < CONFIG.moveThreshold) {
      return;
    }

    const velocity = Math.min(distance / VELOCITY_DISTANCE, VELOCITY_LIMIT);
    const strength = CONFIG.moveStrength * (VELOCITY_BASE + velocity * VELOCITY_SHARE);

    dropInto(point.x, point.y, CONFIG.dropRadius, strength);
    wake();

    lastPointerX = point.x;
    lastPointerY = point.y;
    lastMoveTime = now;
  };

  const press = (event: PointerEvent): void => {
    const point = toCanvasPoint(event);

    if (!isReady || !point) {
      return;
    }

    dropInto(point.x, point.y, CONFIG.dropRadius * CLICK_RADIUS_SCALE, CONFIG.clickStrength);
    wake();
  };

  const leave = (): void => {
    lastPointerX = undefined;
    lastPointerY = undefined;
    lastMoveTime = 0;
  };

  return { move, press, leave };
};

/**
 * Рябь на фоновом изображении главного экрана: при движении курсора по свободным местам фото
 * на воде расходятся круги. «Свободные места» — элементы с data-support-block: прозрачные окна
 * над теми частями фото, где ничего нет. Над панелями, текстом и кнопками рябь не появляется.
 * Фон — картинка с data-animated-background. При «уменьшить движение» и без WebGL остаётся обычное фото.
 */
export const initWaterRipples = (): void => {
  const image = document.querySelector<HTMLImageElement>(IMAGE_SELECTOR);
  const zones = [...document.querySelectorAll<HTMLElement>(ZONE_SELECTOR)];

  if (!image || zones.length === 0 || matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  const ripple = createRipple(image);

  if (!ripple) {
    return;
  }

  // Касание — это прокрутка и нажатия, а не движение по воде: реагируем на мышь и перо
  for (const zone of zones) {
    zone.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'touch') {
          ripple.move(event);
        }
      },
      { passive: true },
    );
    zone.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType !== 'touch') {
          ripple.press(event);
        }
      },
      { passive: true },
    );
    zone.addEventListener('pointerleave', ripple.leave, { passive: true });
  }
};
