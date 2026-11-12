import fs from 'node:fs';

const buf = fs.readFileSync('public/logo-clean.png');
const base64 = buf.toString('base64');
const dataUri = `data:image/png;base64,${base64}`;

const svgDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <image href="${dataUri}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

const svgLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <image href="${dataUri}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

fs.writeFileSync('public/logo-dark.svg', svgDark);
fs.writeFileSync('public/logo-light.svg', svgLight);
fs.writeFileSync('public/logo.svg', svgDark);
console.log('Successfully updated logo-dark.svg, logo-light.svg, and logo.svg without borders!');

