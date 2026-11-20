//@@ rain.vert
// Rain streaks in a box that moves with the camera. Every position comes from the
// instance id and the time, so nothing is uploaded per frame.
layout(location = 0) in vec2 aCorner;   // x: -1..1 across, y: 0 head .. 1 tail
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uTime;
uniform vec3 uFall;                     // drop velocity, m/s
uniform float uBox;                     // half size of the box, m
uniform float uShutter;                 // streak length = speed x shutter
uniform float uDropSize;
out vec2 vQ;
out float vFade;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
    float id = float(gl_InstanceID);
    vec3 r = vec3(h1(id), h1(id + 17.31), h1(id + 41.7));
    vec3 box = vec3(2.0 * uBox, 1.6 * uBox, 2.0 * uBox);
    vec3 p = (r - 0.5) * box + uFall * (uTime * (0.85 + 0.3 * r.z));
    p = mod(p - uCamPos + box * 0.5, box) - box * 0.5 + uCamPos;
    vec3 axis = -uFall * uShutter;
    vec3 side = normalize(cross(axis, uCamPos - p)) * (0.006 + 0.006 * r.y) * uDropSize;
    vec3 w = p + axis * aCorner.y + side * aCorner.x;
    vQ = aCorner;
    float d = length(p - uCamPos);
    vFade = smoothstep(uBox, uBox * 0.4, d) * smoothstep(2.0, 5.0, d) * step(0.0, p.y + 0.3);   // none smeared across the screen right in front of the eye
    gl_Position = uViewProj * vec4(w, 1.0);
}
//@@ rain.frag
in vec2 vQ;
in float vFade;
uniform float uAmount;
uniform float uEnvMaxLod;
out vec4 fragColor;
// drops refract the sky behind them and catch a little sun: drawn additively
void main() {
    float a = (1.0 - vQ.x * vQ.x) * sin(3.14159 * vQ.y) * vFade * uAmount;
    vec3 c = envAmbient(uEnvMaxLod) * 0.42 + uSunColor * 0.006;
    fragColor = vec4(encodeHDR(c * a), 0.0);
}
//@@ spray.vert
// Spray, splashes and wake mist: CPU particles drawn as lumpy, lit clumps of white water
// (ragged edges from noise, shaded as a rough ball under the sun and sky), stretched into
// streaks along their motion like drops seen in a short exposure.
layout(location = 0) in vec2 aCorner;   // -1..1
layout(location = 1) in vec4 aPosSize;  // per instance: world position, radius
layout(location = 2) in float aAlpha;
layout(location = 3) in vec3 aVel;      // per instance: velocity, m/s
uniform mat4 uViewProj;
uniform vec3 uCamRight, uCamUp;
uniform float uEnvMaxLod;
uniform float uShutter;                 // a drop is drawn as the streak it makes in this time
out vec2 vQ;
out float vA;
flat out vec3 vAcross, vAlong, vView, vAmb;
flat out float vSeed, vSmoke, vStreak;
void main() {
    vec3 Vd = normalize(uCamPos - aPosSize.xyz);
    vec3 m = aVel * uShutter;
    m -= Vd * dot(m, Vd);
    float len = length(m), r = aPosSize.w;
    vec3 along = len > 1e-4 ? m / len : uCamUp;
    vec3 across = len > 1e-4 ? normalize(cross(along, Vd)) : uCamRight;
    if (len <= 1e-4) along = normalize(cross(Vd, across));
    float half_ = r + 0.5 * len;
    vec3 w = aPosSize.xyz + across * (aCorner.x * r) + along * (aCorner.y * half_);
    vQ = aCorner;
    vA = abs(aAlpha) * mix(1.0, r / half_, 0.6);                        // the same water spread over a longer streak
    vSmoke = step(aAlpha, 0.0);                                         // negative alpha: grey gun smoke
    vSeed = fract(sin(float(gl_InstanceID) * 12.9898 + 1.7) * 43758.5453);
    vStreak = clamp(len / max(half_, 1e-4), 0.0, 1.0);
    vAcross = across; vAlong = along; vView = Vd;
    vAmb = envAmbient(uEnvMaxLod);
    gl_Position = uViewProj * vec4(w, 1.0);
}
//@@ spray.frag
in vec2 vQ;
in float vA;
flat in vec3 vAcross, vAlong, vView, vAmb;
flat in float vSeed, vSmoke, vStreak;
out vec4 fragColor;
void main() {
    float r2 = dot(vQ, vQ);
    if (r2 > 1.0) discard;
    vec2 o = vec2(vSeed * 37.0, vSeed * 91.0);
    float nz = 0.62 * vnoise(vQ * 2.2 + o) + 0.38 * vnoise(vQ * 5.3 - o);
    float lump = mix(0.55, 0.25, vStreak);                              // streaks stay smooth, clumps break up
    float dens = (1.0 - r2) * 1.3 + (nz - 0.5) * 2.0 * lump;
    if (dens <= 0.0) discard;
    float a = smoothstep(0.0, 0.5, dens) * min(vA, 1.0);
    // shaded as a rough white ball: a lit top, a darker underside, light through its thin edges
    float z = sqrt(max(1.0 - r2, 0.0));
    vec3 N = normalize(vAcross * vQ.x + vAlong * vQ.y + vView * (z + 0.15) + (vec3(nz) - 0.5) * 0.7);
    float sunLit = max(dot(N, uSunDir), 0.0);
    float back = pow(max(dot(-vView, uSunDir), 0.0), 5.0) * (1.0 - smoothstep(0.2, 0.9, dens));
    float alb = mix(0.78, 0.3, vSmoke);
    vec3 col = alb * (uSunColor * (sunLit * 0.85 + 0.12) / PI + vAmb * (0.55 + 0.45 * clamp(N.y * 0.5 + 0.5, 0.0, 1.0))) + uSunColor * back * 0.25;
    fragColor = vec4(encodeHDR(col) * a, a);
}
