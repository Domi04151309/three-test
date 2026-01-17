export const vertexShader = `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vNormalY;
    #include <fog_pars_vertex>
    void main() {
      vNormal = normalize(mat3(modelMatrix) * normal);
      vNormalY = vNormal.y;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

export const fragmentShader = `
    precision lowp float;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vNormalY;
    #include <fog_pars_fragment>
    uniform sampler2D noiseTex;
    uniform sampler2D grassTex;
    uniform sampler2D dirtTex;
    uniform sampler2D rockTex;
    uniform sampler2D sandTex;
    uniform sampler2D snowTex;
    uniform vec3 grassColor;
    uniform vec3 dirtColor;
    uniform vec3 rockColor;
    uniform float noiseScale;
    uniform float noiseAmp;
    uniform float slopeHigh;
    uniform float slopeLow;
    uniform float heightRockStart;
    uniform float heightRockEnd;
    uniform float waterLevel;
    uniform vec3 sandColor;
    uniform float snowLevel;
    uniform vec3 snowColor;
    // Lighting
    uniform vec3 sunDirection;
    uniform vec3 lightColor;
    uniform float sunIntensity;
    uniform float ambientIntensity;

    void main() {
      vec2 nUv = vWorldPos.xz * noiseScale;
      float n = texture2D(noiseTex, fract(nUv)).r;
      float h = vWorldPos.y + (n - 0.5) * noiseAmp;

      float slope = 1.0 - vNormalY;
      float rockFactor = smoothstep(slopeLow, 1.0, slope);
      float grassFactor = smoothstep(slopeHigh, 1.0, vNormalY);
      float dirtFactor = 1.0 - clamp(rockFactor + grassFactor, 0.0, 1.0);

      float heightBias = smoothstep(heightRockStart, heightRockEnd, h);
      rockFactor = clamp(rockFactor + heightBias * 0.6, 0.0, 1.0);

      float noiseInfluence = (n - 0.5) * noiseAmp;
      rockFactor = clamp(rockFactor + noiseInfluence * 0.5, 0.0, 1.0);
      grassFactor = clamp(grassFactor - noiseInfluence * 0.5, 0.0, 1.0);
      dirtFactor = 1.0 - clamp(rockFactor + grassFactor, 0.0, 1.0);
      float isUnder = h < waterLevel ? 1.0 : 0.0;

      vec2 uv = vWorldPos.xz * 0.05;

      vec4 tG = texture2D(grassTex, uv);
      vec4 tD = texture2D(dirtTex, uv);
      vec4 tR = texture2D(rockTex, uv);
      vec4 tSa = texture2D(sandTex, uv);
      vec4 tSn = texture2D(snowTex, uv);

      float texGrass = dot(tG.rgb, vec3(0.2126, 0.7152, 0.0722));
      float texDirt = dot(tD.rgb, vec3(0.2126, 0.7152, 0.0722));
      float texRock = dot(tR.rgb, vec3(0.2126, 0.7152, 0.0722));
      float texSand = dot(tSa.rgb, vec3(0.2126, 0.7152, 0.0722));
      float texSnow = dot(tSn.rgb, vec3(0.2126, 0.7152, 0.0722));

      vec3 finalGrass = grassColor * texGrass * 1.0;
      vec3 finalSand  = sandColor * texSand * 1.0;
      vec3 finalSnow  = snowColor * texSnow * 1.0;
      vec3 finalDirt  = dirtColor * texDirt * 1.0;
      vec3 finalRock  = rockColor * texRock * 1.0;

      vec3 grainGrass = mix(finalGrass, finalSand, isUnder);
      grainGrass = mix(grainGrass, finalSnow, step(snowLevel, h));

      vec3 col = rockFactor * finalRock + dirtFactor * finalDirt + grassFactor * grainGrass;

      // lighting (damped sun contribution to avoid overexposure)
      vec3 nrm = normalize(vNormal);
      float ndl = max(dot(nrm, normalize(sunDirection)), 0.0);
      float sunFactor = clamp(sunIntensity * 0.08, 0.0, 1.0);
      vec3 lighting = vec3(ambientIntensity) + lightColor * sunFactor * ndl;
      col *= lighting;

      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `;
