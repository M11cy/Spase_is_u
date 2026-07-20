import { ShaderMaterial, Vector2 } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export const BLOOM_SCENE_LAYER = 1;

export const enableDeepSpaceBloom = (object) => {
  object.layers.enable(BLOOM_SCENE_LAYER);
  return object;
};

const COMPOSITE_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const COMPOSITE_FRAGMENT_SHADER = `
  uniform sampler2D baseTexture;
  uniform sampler2D bloomTexture;
  varying vec2 vUv;

  void main() {
    vec4 baseColor = texture2D(baseTexture, vUv);
    vec3 bloomColor = texture2D(bloomTexture, vUv).rgb;
    gl_FragColor = vec4(baseColor.rgb + bloomColor, baseColor.a);
  }
`;

const createDefaultComposer = ({ renderer, scene, camera, quality }) => {
  let bloomComposer = null;
  let finalComposer = null;
  let bloomPass = null;
  let compositeMaterial = null;
  let compositePass = null;
  let outputPass = null;
  try {
    bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new Vector2(1, 1),
      quality.bloomStrength,
      quality.bloomRadius,
      quality.bloomThreshold
    );
    bloomComposer.addPass(bloomPass);

    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(new RenderPass(scene, camera));
    compositeMaterial = new ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader: COMPOSITE_VERTEX_SHADER,
      fragmentShader: COMPOSITE_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false
    });
    compositePass = new ShaderPass(compositeMaterial, "baseTexture");
    finalComposer.addPass(compositePass);
    outputPass = new OutputPass();
    finalComposer.addPass(outputPass);
  } catch (error) {
    outputPass?.dispose();
    if (compositePass) {
      compositePass.dispose();
    } else {
      compositeMaterial?.dispose();
    }
    bloomPass?.dispose();
    finalComposer?.dispose();
    bloomComposer?.dispose();
    throw error;
  }

  let disposed = false;
  return Object.freeze({
    render: () => {
      const cameraLayerMask = camera.layers.mask;
      try {
        camera.layers.set(BLOOM_SCENE_LAYER);
        bloomComposer.render();
      } finally {
        camera.layers.mask = cameraLayerMask;
      }
      finalComposer.render();
    },
    setPixelRatios: ({ base, bloom }) => {
      bloomComposer.setPixelRatio(bloom);
      finalComposer.setPixelRatio(base);
    },
    setSize: (width, height) => {
      bloomComposer.setSize(width, height);
      finalComposer.setSize(width, height);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      bloomPass.dispose();
      compositePass.dispose();
      outputPass.dispose();
      bloomComposer.dispose();
      finalComposer.dispose();
    }
  });
};

const defaultFactories = Object.freeze({ createComposer: createDefaultComposer });

export const createDeepSpacePostprocessing = (input = {}) => {
  const {
    renderer,
    scene,
    camera,
    quality = {},
    factories = defaultFactories
  } = input;
  let composer = null;
  try {
    if (quality.bloomEnabled) {
      composer = factories.createComposer({ renderer, scene, camera, quality });
    }
  } catch {
    composer = null;
  }

  let disposed = false;
  let active = Boolean(composer);
  const disableComposer = (markInactive = true) => {
    if (markInactive) active = false;
    if (!composer) return;
    const failedComposer = composer;
    composer = null;
    try {
      failedComposer.dispose();
    } catch {
      // Direct rendering remains available even if addon cleanup fails.
    }
  };
  return Object.freeze({
    get active() {
      return active;
    },
    render: () => {
      if (disposed) return;
      if (composer) {
        try {
          composer.render();
          return;
        } catch {
          disableComposer();
        }
      }
      renderer.render(scene, camera);
    },
    resize: ({ width, height, pixelRatio }) => {
      if (disposed || !composer) return;
      try {
        composer.setPixelRatios({
          base: pixelRatio,
          bloom: pixelRatio * quality.bloomScale
        });
        composer.setSize(width, height);
      } catch {
        disableComposer();
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disableComposer(false);
    }
  });
};
