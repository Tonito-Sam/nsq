import type * as tf from '@tensorflow/tfjs-core';

export type ReelBackgroundEffect = 'original' | 'blur' | 'studio' | 'slate' | 'warm';

export interface ReelBackgroundProcessor {
  stream: MediaStream;
  dispose: () => void;
}

const vertexShaderSource = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVideo;
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform float uFocusDepth;
uniform float uFocusRange;
uniform float uHasDepth;
uniform int uEffect;

float getDepth(vec2 uv) {
  return texture(uDepth, clamp(uv, vec2(0.001), vec2(0.999))).r;
}

vec3 bokehBlur(vec2 uv, float centerDepth) {
  float focusDelta = abs(centerDepth - uFocusDepth);
  float circleOfConfusion = smoothstep(uFocusRange, uFocusRange + 0.3, focusDelta);
  float radius = circleOfConfusion * min(uResolution.x, uResolution.y) * 0.055;
  vec3 colorSum = texture(uVideo, uv).rgb;
  float weightSum = 1.0;

  for (int index = 0; index < 16; index++) {
    float sampleIndex = float(index) + 0.5;
    float angle = sampleIndex * 2.39996323;
    float distance = sqrt(sampleIndex / 16.0) * radius;
    vec2 offset = vec2(cos(angle), sin(angle)) * distance / uResolution;
    vec2 sampleUv = clamp(uv + offset, vec2(0.001), vec2(0.999));
    float sampleDepth = getDepth(sampleUv);
    bool backgroundPixel = focusDelta > uFocusRange;
    bool foregroundLeak = backgroundPixel && abs(sampleDepth - uFocusDepth) <= uFocusRange * 1.6;

    if (!foregroundLeak) {
      colorSum += texture(uVideo, sampleUv).rgb;
      weightSum += 1.0;
    }
  }

  return colorSum / weightSum;
}

vec3 studioBackground(vec2 uv) {
  vec3 top = vec3(0.96, 0.96, 0.94);
  vec3 bottom = vec3(0.66, 0.64, 0.61);
  vec3 color = mix(top, bottom, smoothstep(0.0, 1.0, uv.y));
  float glow = exp(-distance(uv, vec2(0.2, 0.82)) * 2.6) * 0.22;
  return color + vec3(glow);
}

vec3 slateBackground(vec2 uv) {
  return mix(vec3(0.88, 0.91, 0.95), vec3(0.22, 0.29, 0.38), smoothstep(0.0, 1.0, uv.y));
}

vec3 warmBackground(vec2 uv) {
  vec3 color = mix(vec3(1.0, 0.95, 0.80), vec3(0.56, 0.35, 0.31), smoothstep(0.0, 1.0, uv.y));
  float glow = exp(-distance(uv, vec2(0.18, 0.82)) * 2.2) * 0.2;
  return color + vec3(glow, glow * 0.72, glow * 0.42);
}

void main() {
  vec3 cameraColor = texture(uVideo, vUv).rgb;
  if (uHasDepth < 0.5 || uEffect == 0) {
    outColor = vec4(cameraColor, 1.0);
    return;
  }

  float depth = getDepth(vUv);
  if (uEffect == 1) {
    outColor = vec4(bokehBlur(vUv, depth), 1.0);
    return;
  }

  float subjectMask = 1.0 - smoothstep(
    uFocusRange * 1.2,
    uFocusRange * 2.2,
    abs(depth - uFocusDepth)
  );
  vec3 backgroundColor = uEffect == 2 ? studioBackground(vUv)
    : uEffect == 3 ? slateBackground(vUv)
    : warmBackground(vUv);
  outColor = vec4(mix(backgroundColor, cameraColor, subjectMask), 1.0);
}`;

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not allocate a background effect shader.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error.';
    gl.deleteShader(shader);
    throw new Error(`Could not compile a background effect shader: ${message}`);
  }
  return shader;
};

const estimatePortraitFocus = (
  values: Float32Array,
  width: number,
  height: number,
  previousFocus: number,
): { focus: number; range: number } => {
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));

  for (let y = Math.floor(height * 0.12); y < height * 0.92; y += step) {
    for (let x = Math.floor(width * 0.18); x < width * 0.82; x += step) {
      const value = values[y * width + x];
      if (Number.isFinite(value) && value > 0.015) samples.push(value);
    }
  }

  if (samples.length < 20) return { focus: previousFocus, range: 0.08 };

  samples.sort((left, right) => left - right);
  const focus = samples[Math.floor(samples.length * 0.42)];
  const nearDepth = samples[Math.floor(samples.length * 0.12)];
  const farDepth = samples[Math.floor(samples.length * 0.88)];
  const range = Math.max(0.035, Math.min(0.12, (farDepth - nearDepth) * 0.12));

  return {
    focus: previousFocus + (focus - previousFocus) * 0.22,
    range,
  };
};

const initializeTensorFlow = async () => {
  const tfjs = await import('@tensorflow/tfjs-core');
  await Promise.all([
    import('@tensorflow/tfjs-converter'),
    import('@tensorflow/tfjs-backend-webgl'),
    import('@tensorflow-models/body-segmentation'),
  ]);
  const backendReady = await tfjs.setBackend('webgl');
  if (!backendReady) throw new Error('TensorFlow.js could not initialize the WebGL backend.');
  await tfjs.ready();

  const depthEstimation = await import('@tensorflow-models/depth-estimation');
  const estimator = await depthEstimation.createEstimator(depthEstimation.SupportedModels.ARPortraitDepth);
  return estimator;
};

export const createReelBackgroundProcessor = async (
  sourceVideo: HTMLVideoElement,
  sourceStream: MediaStream,
  outputCanvas: HTMLCanvasElement,
  getEffect: () => ReelBackgroundEffect,
  onError: (error: unknown) => void,
): Promise<ReelBackgroundProcessor> => {
  const estimator = await initializeTensorFlow();
  const gl = outputCanvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    estimator.dispose();
    throw new Error('This browser does not support WebGL 2 background effects.');
  }

  let program: WebGLProgram | null = null;
  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;
  const vertexBuffer = gl.createBuffer();
  const vertexArray = gl.createVertexArray();
  const videoTexture = gl.createTexture();
  const depthTexture = gl.createTexture();

  try {
    if (!vertexBuffer || !vertexArray || !videoTexture || !depthTexture) {
      throw new Error('Could not allocate background effect rendering resources.');
    }

    vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    program = gl.createProgram();
    if (!program) throw new Error('Could not create the background effect renderer.');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Could not link the background effect renderer.');
    }

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const setupTexture = (texture: WebGLTexture, unit: number, uniform: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const location = gl.getUniformLocation(program!, uniform);
      if (location) gl.uniform1i(location, unit);
    };

    gl.useProgram(program);
    setupTexture(videoTexture, 0, 'uVideo');
    setupTexture(depthTexture, 1, 'uDepth');
  } catch (error) {
    estimator.dispose();
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (videoTexture) gl.deleteTexture(videoTexture);
    if (depthTexture) gl.deleteTexture(depthTexture);
    throw error;
  }

  const depthCanvas = document.createElement('canvas');
  const depthContext = depthCanvas.getContext('2d', { willReadFrequently: true });
  const estimationCanvas = document.createElement('canvas');
  const estimationContext = estimationCanvas.getContext('2d');
  if (!depthContext || !estimationContext) {
    estimator.dispose();
    throw new Error('Could not prepare the live depth renderer.');
  }

  const videoLocation = gl.getUniformLocation(program, 'uVideo');
  const depthLocation = gl.getUniformLocation(program, 'uDepth');
  const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
  const focusLocation = gl.getUniformLocation(program, 'uFocusDepth');
  const rangeLocation = gl.getUniformLocation(program, 'uFocusRange');
  const hasDepthLocation = gl.getUniformLocation(program, 'uHasDepth');
  const effectLocation = gl.getUniformLocation(program, 'uEffect');

  if (
    !videoLocation ||
    !depthLocation ||
    !resolutionLocation ||
    !focusLocation ||
    !rangeLocation ||
    !hasDepthLocation ||
    !effectLocation
  ) {
    estimator.dispose();
    throw new Error('Could not initialize the live depth renderer.');
  }

  let outputStream: MediaStream;
  try {
    outputStream = outputCanvas.captureStream(24);
  } catch (error) {
    estimator.dispose();
    console.error('[RecordReel] Could not capture the WebGL effect canvas:', error);
    throw new Error('This browser does not support recording background effects.');
  }

  sourceStream.getAudioTracks().forEach((track) => outputStream.addTrack(track));

  let disposed = false;
  let failed = false;
  let inferenceRunning = false;
  let hasDepth = false;
  let animationFrame = 0;
  let lastVideoTime = -1;
  let lastInferenceAt = 0;
  let focusDepth = 0.5;
  let focusRange = 0.08;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    outputStream.getVideoTracks().forEach((track) => track.stop());
    estimator.dispose();
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteVertexArray(vertexArray);
    gl.deleteTexture(videoTexture);
    gl.deleteTexture(depthTexture);
  };

  const fail = (error: unknown) => {
    if (failed || disposed) return;
    failed = true;
    onError(error);
  };

  const updateDepth = async (width: number, height: number) => {
    inferenceRunning = true;
    lastInferenceAt = performance.now();
    let depthTensor: tf.Tensor2D | null = null;

    try {
      const scale = Math.min(1, 320 / Math.max(width, height));
      estimationCanvas.width = Math.max(1, Math.round(width * scale));
      estimationCanvas.height = Math.max(1, Math.round(height * scale));
      estimationContext.drawImage(sourceVideo, 0, 0, estimationCanvas.width, estimationCanvas.height);

      const depthMap = await estimator.estimateDepth(estimationCanvas, {
        minDepth: 0,
        maxDepth: 1,
      });
      if (disposed || failed) return;

      depthTensor = await depthMap.toTensor();
      const tensorData = await depthTensor.data();
      if (!(tensorData instanceof Float32Array)) {
        throw new Error('The depth model returned an unsupported depth map format.');
      }
      const values = tensorData;
      const mapWidth = depthTensor.shape[1];
      const mapHeight = depthTensor.shape[0];
      const nextFocus = estimatePortraitFocus(values, mapWidth, mapHeight, focusDepth);
      focusDepth = nextFocus.focus;
      focusRange = nextFocus.range;

      depthCanvas.width = mapWidth;
      depthCanvas.height = mapHeight;
      const depthImage = depthContext.createImageData(mapWidth, mapHeight);
      for (let index = 0; index < values.length; index += 1) {
        const depth = Math.max(0, Math.min(1, values[index]));
        const channel = Math.round(depth * 255);
        const offset = index * 4;
        depthImage.data[offset] = channel;
        depthImage.data[offset + 1] = channel;
        depthImage.data[offset + 2] = channel;
        depthImage.data[offset + 3] = 255;
      }
      depthContext.putImageData(depthImage, 0, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthCanvas);
      hasDepth = true;
    } finally {
      depthTensor?.dispose();
      inferenceRunning = false;
    }
  };

  const renderFrame = () => {
    if (disposed) return;
    animationFrame = requestAnimationFrame(renderFrame);

    if (
      sourceVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      sourceVideo.videoWidth === 0 ||
      sourceVideo.videoHeight === 0 ||
      sourceVideo.currentTime === lastVideoTime
    ) {
      return;
    }

    lastVideoTime = sourceVideo.currentTime;
    const scale = Math.min(1, 1280 / sourceVideo.videoWidth);
    const width = Math.max(1, Math.round(sourceVideo.videoWidth * scale));
    const height = Math.max(1, Math.round(sourceVideo.videoHeight * scale));
    if (outputCanvas.width !== width || outputCanvas.height !== height) {
      outputCanvas.width = width;
      outputCanvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceVideo);

    gl.uniform1i(videoLocation, 0);
    gl.uniform1i(depthLocation, 1);
    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform1f(focusLocation, focusDepth);
    gl.uniform1f(rangeLocation, focusRange);
    gl.uniform1f(hasDepthLocation, hasDepth ? 1 : 0);

    const effect = getEffect();
    const effectValue = effect === 'original' ? 0
      : effect === 'blur' ? 1
      : effect === 'studio' ? 2
      : effect === 'slate' ? 3
      : 4;
    gl.uniform1i(effectLocation, effectValue);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (
      effect !== 'original' &&
      !failed &&
      !inferenceRunning &&
      performance.now() - lastInferenceAt >= 120
    ) {
      void updateDepth(sourceVideo.videoWidth, sourceVideo.videoHeight).catch((error: unknown) => {
        console.error('[RecordReel] Live depth estimation failed:', error);
        fail(error);
      });
    }
  };

  if (
    sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    sourceVideo.videoWidth > 0 &&
    sourceVideo.videoHeight > 0
  ) {
    const scale = Math.min(1, 1280 / sourceVideo.videoWidth);
    outputCanvas.width = Math.max(1, Math.round(sourceVideo.videoWidth * scale));
    outputCanvas.height = Math.max(1, Math.round(sourceVideo.videoHeight * scale));
    gl.viewport(0, 0, outputCanvas.width, outputCanvas.height);
    try {
      await updateDepth(sourceVideo.videoWidth, sourceVideo.videoHeight);
    } catch (error) {
      dispose();
      throw error;
    }
  }

  renderFrame();

  return {
    stream: outputStream,
    dispose,
  };
};
