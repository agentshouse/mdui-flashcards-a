import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

// Inspect the actual built dependency CSS, without pretending that jsdom
// implements media-query evaluation or a browser's computed style engine.
const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'dist/assets');
const cssFiles = fs.readdirSync(assets).filter(file => file.endsWith('.css'));
assert.equal(cssFiles.length, 1);
const css = postcss.parse(fs.readFileSync(path.join(assets, cssFiles[0]), 'utf8'));
const palettes = [];
css.walkRules(rule => {
  const foreground = rule.nodes.find(node => node.prop === '--color-fg-default');
  if (!foreground) return;
  assert(!foreground.important);
  assert(rule.parent.type === 'root' || (rule.parent.type === 'atrule' && rule.parent.name === 'media'));
  palettes.push({selector: rule.selector, media: rule.parent.params ?? null, foreground: foreground.value});
});
assert.equal(palettes.length, 4, 'Review new competing palette rules before publishing');
for (const [mode, foreground] of [['dark', '#c9d1d9'], ['light', '#24292f']]) {
  const automatic = palettes.find(rule => rule.media?.replaceAll(' ', '') === `(prefers-color-scheme:${mode})`);
  const explicit = palettes.find(rule => rule.media === null && rule.selector.includes(`[data-color-mode*=${mode}]`));
  assert(automatic && explicit);
  assert.equal(automatic.foreground, foreground);
  assert.equal(explicit.foreground, foreground);
  for (const className of ['wmde-markdown', 'wmde-markdown-var']) {
    assert(automatic.selector.split(',').includes(`.${className}`));
    assert(explicit.selector.split(',').includes(`.${className}[data-color-mode*=${mode}]`));
    assert(explicit.selector.split(',').includes(`[data-color-mode*=${mode}] .${className}`));
  }
}
// Both explicit palette selectors have specificity 0,2,0, above the automatic
// media rule's 0,1,0. Light also comes after an equally specific dark ancestor.
assert(palettes.findIndex(rule => rule.media === null && rule.foreground === '#24292f') > palettes.findIndex(rule => rule.media === null && rule.foreground === '#c9d1d9'));
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrastOnWhite = hex => +(1.05 / (luminance(hex) + .05)).toFixed(2);
const theme = {};
css.walkDecls(/^--color-(?:zinc-(?:400|600)|indigo-50)$/, declaration => {theme[declaration.prop] = declaration.value;});
const oklchLuminance = value => {
  const match = value.match(/^oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)\)$/);
  assert(match, `Unexpected color token ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = Number(match[4]) * Math.PI / 180;
  const a = chroma * Math.cos(hue), b = chroma * Math.sin(hue);
  const l = (lightness + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (lightness - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (lightness - .0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
  // These are static sRGB-clamped reference calculations. A browser's gamut
  // mapping and composited translucent surfaces require separate visual QA.
  const srgb = rgb.map(channel => Math.min(1, Math.max(0, channel)));
  return srgb[0] * .2126 + srgb[1] * .7152 + srgb[2] * .0722;
};
const helperContrast = {};
for (const [label, backdrop] of [['white', 1], ['indigo50', oklchLuminance(theme['--color-indigo-50'])]]) {
  const before = (backdrop + .05) / (oklchLuminance(theme['--color-zinc-400']) + .05);
  const after = (backdrop + .05) / (oklchLuminance(theme['--color-zinc-600']) + .05);
  assert(after >= 4.5, 'Light helper text must retain at least 4.5:1 on the checked surfaces');
  helperContrast[label] = {before: +before.toFixed(2), after: +after.toFixed(2)};
}
const report = {
  scope: 'Static inspection of the built CSS cascade, not emulated or hosted browser computed-style evidence',
  cssFile: `assets/${cssFiles[0]}`, palettes,
  explicitLightSpecificity: [0, 2, 0], automaticSchemeSpecificity: [0, 1, 0],
  originalUnpinnedDarkForeground: '#c9d1d9', originalContrastOnWhite: contrastOnWhite('#c9d1d9'),
  fixedLightAndDarkForeground: '#24292f', fixedContrastOnWhite: contrastOnWhite('#24292f'),
  helperPalette: theme, helperContrast,
  helperCalculation: 'OKLCH converted to linear sRGB and clamped; static reference surfaces, not composited browser measurements',
};
fs.writeFileSync(path.join(root, 'reports/markdown-theme-cascade.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
