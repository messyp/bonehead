import { hexToVec } from '../art/palette.js';

const VS = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uPix, uTime, uSpin, uSpeed, uCRT, uImpact, uBloom, uBright, uWarp;
uniform vec3 uC1, uC2, uC3;
uniform vec4 uFlash;
in vec2 vUv; out vec4 o;

float bayer(vec2 p){
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y*4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[i]/16.0;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

vec3 swirl(vec2 frag){
  float cell = max(1.0, uPix*2.0);
  vec2 q = floor(frag/cell);
  vec2 uv = ((q+0.5)*cell - 0.5*uRes)/length(uRes);
  float t = uTime*uSpeed;
  float r = length(uv);
  float a = atan(uv.y, uv.x) + uSpin*(1.3 - r)*2.6 + t*0.22;
  vec2 p = vec2(cos(a), sin(a))*r*6.5;
  for(int i=0;i<5;i++){
    float fi = float(i);
    p += 0.62*vec2(sin(p.y*0.92 + t*1.21 + fi*1.7), cos(p.x*0.83 - t*0.97 + fi*2.3));
  }
  float v = 0.5+0.5*sin(p.x*0.9 + p.y*0.75 + t*0.45);
  float w = 0.5+0.5*sin(length(p)*0.85 - t*1.1);
  float d = bayer(q) - 0.5;
  float lv = floor(clamp(v + d*0.24, 0.0, 0.999)*5.0)/4.0;
  float lw = floor(clamp(w + d*0.24, 0.0, 0.999)*4.0)/3.0;
  vec3 col = mix(uC2, uC1, lv);
  col = mix(col, uC3, lw*lw*0.6);
  col *= 0.78 + 0.32*(1.0 - r*1.15);
  return col*uBright;
}

void main(){
  vec2 c = vUv - 0.5;
  float k = 0.028*uCRT + 0.05*uImpact + uWarp;
  vec2 duv = vUv + c*dot(c,c)*k*2.0;
  vec2 suv = vec2(duv.x, 1.0-duv.y);
  vec3 bg = swirl(duv*uRes);
  vec2 ab = c*(0.0016*uCRT + 0.012*uImpact);
  vec4 sc = texture(uScene, suv);
  float r = texture(uScene, suv + vec2(ab.x, -ab.y)).r;
  float b = texture(uScene, suv - vec2(ab.x, -ab.y)).b;
  // Vignette the background strongly; the game layer (cards, buttons) only faintly at the very edge.
  bg *= 1.0 - dot(c,c)*(0.55 + 0.5*uCRT);
  vec3 col = bg*(1.0 - sc.a) + vec3(r, sc.g, b)*(1.0 - smoothstep(0.55, 0.8, length(c))*0.15);
  vec3 bl = textureLod(uScene, suv, 4.0).rgb*0.55 + textureLod(uScene, suv, 6.0).rgb*0.45;
  float lum = dot(bl, vec3(0.3, 0.59, 0.11));
  // Only coloured light blooms (gold, fire, glows). White card faces would otherwise
  // haze over their own red pips and wash them out.
  float sat = max(bl.r, max(bl.g, bl.b)) - min(bl.r, min(bl.g, bl.b));
  col += bl*smoothstep(0.35, 0.95, lum)*smoothstep(0.15, 0.45, sat)*uBloom;
  float sl = 0.5 + 0.5*cos(gl_FragCoord.y*6.2831/max(2.0, uPix));
  col *= 1.0 - uCRT*0.06*sl;
  col = mix(col, uFlash.rgb, uFlash.a);
  col += (hash(gl_FragCoord.xy + fract(uTime)*97.0) - 0.5)*0.03*uCRT;
  if(duv.x<0.0||duv.y<0.0||duv.x>1.0||duv.y>1.0) col = vec3(0.0);
  o = vec4(col, 1.0);
}`;

export const Post = {
  gl: null, ok: false, view: null, ctx2d: null,
  u: {}, tex: null,
  // Live values the game can animate.
  state: { c1: [0.06, 0.29, 0.29], c2: [0.07, 0.12, 0.25], c3: [0.12, 0.44, 0.39], spin: 0.8, speed: 1, crt: 1, impact: 0, bloom: 0.55, bright: 1, warp: 0, flash: [1, 1, 1, 0] },
  target: { c1: null, c2: null, c3: null, spin: 0.8, speed: 1, bright: 1 },

  init(view, allowGL = true) {
    this.view = view;
    try {
      if (!allowGL) throw new Error('safe rendering: WebGL off');
      const gl = view.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('no webgl2');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uScene', 'uRes', 'uPix', 'uTime', 'uSpin', 'uSpeed', 'uCRT', 'uImpact', 'uBloom', 'uBright', 'uWarp', 'uC1', 'uC2', 'uC3', 'uFlash']) this.u[n] = gl.getUniformLocation(prog, n);
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.uniform1i(this.u.uScene, 0);
      view.addEventListener('webglcontextlost', e => { e.preventDefault(); this.ok = false; });
      this.gl = gl; this.ok = true;
    } catch (err) {
      console.warn('WebGL post-processing unavailable, using 2D fallback.', err);
      this.ok = false;
      this.ctx2d = view.getContext('2d');
    }
  },

  theme(t, instant = false) {
    this.target.c1 = hexToVec(t.a); this.target.c2 = hexToVec(t.b); this.target.c3 = hexToVec(t.c);
    if (instant) { this.state.c1 = [...this.target.c1]; this.state.c2 = [...this.target.c2]; this.state.c3 = [...this.target.c3]; }
  },

  update(dt) {
    const s = this.state, tg = this.target, f = 1 - Math.exp(-dt * 2.2);
    for (const key of ['c1', 'c2', 'c3']) if (tg[key]) for (let i = 0; i < 3; i++) s[key][i] += (tg[key][i] - s[key][i]) * f;
    s.spin += (tg.spin - s.spin) * f; s.speed += (tg.speed - s.speed) * f; s.bright += (tg.bright - s.bright) * f;
    s.impact = Math.max(0, s.impact - dt * 2.5);
    s.flash[3] = Math.max(0, s.flash[3] - dt * 3.2);
  },

  flash(rgb, a = 0.5) { this.state.flash = [...rgb, Math.max(this.state.flash[3], a)]; },
  impact(a = 0.6) { this.state.impact = Math.min(1, this.state.impact + a); },

  render(scene, S, time) {
    const s = this.state;
    if (!this.ok) {
      const ctx = this.ctx2d; if (!ctx) return;
      const W = this.view.width, H = this.view.height;
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
      const c = v => `rgb(${v.map(x => Math.round(x * 255)).join(',')})`;
      g.addColorStop(0, c(s.c1)); g.addColorStop(1, c(s.c2));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(scene, 0, 0);
      if (s.flash[3] > 0) { ctx.fillStyle = `rgba(${s.flash.slice(0, 3).map(x => Math.round(x * 255)).join(',')},${s.flash[3]})`; ctx.fillRect(0, 0, W, H); }
      return;
    }
    const gl = this.gl, u = this.u;
    gl.viewport(0, 0, this.view.width, this.view.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform2f(u.uRes, this.view.width, this.view.height);
    gl.uniform1f(u.uPix, S); gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uSpin, s.spin); gl.uniform1f(u.uSpeed, s.speed); gl.uniform1f(u.uCRT, s.crt);
    gl.uniform1f(u.uImpact, s.impact); gl.uniform1f(u.uBloom, s.bloom); gl.uniform1f(u.uBright, s.bright); gl.uniform1f(u.uWarp, s.warp);
    gl.uniform3fv(u.uC1, s.c1); gl.uniform3fv(u.uC2, s.c2); gl.uniform3fv(u.uC3, s.c3);
    gl.uniform4fv(u.uFlash, s.flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },
};
