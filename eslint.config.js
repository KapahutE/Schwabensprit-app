// Prüfung der App-Skripte. Die Skripte sind klassische Skripte ohne Module und teilen sich den globalen Gültigkeitsbereich;
// deshalb werden alle Namen auf oberster Ebene (Funktionen, const, let, class) als Globale der anderen Dateien eingetragen.
const fs = require("fs"), path = require("path"), espree = require("espree"), globals = require("globals");

const APP = fs.readdirSync(path.join(__dirname, "js")).filter((f) => f.endsWith(".js")).map((f) => path.join("js", f));
const shared = {};
const names = (p) => p.type === "Identifier" ? [p.name] : p.type === "ObjectPattern" ? p.properties.flatMap((x) => names(x.value || x.argument)) : p.type === "ArrayPattern" ? p.elements.filter(Boolean).flatMap(names) : p.type === "AssignmentPattern" ? names(p.left) : p.type === "RestElement" ? names(p.argument) : [];
for (const f of APP) {
  for (const n of espree.parse(fs.readFileSync(path.join(__dirname, f), "utf8"), { ecmaVersion: 2023, sourceType: "script" }).body) {
    if (n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") shared[n.id.name] = "writable";
    else if (n.type === "VariableDeclaration") n.declarations.forEach((d) => names(d.id).forEach((x) => { shared[x] = n.kind === "const" ? "readonly" : "writable"; }));
  }
}

module.exports = [
  { ignores: ["node_modules/**", "ocr/**", "tests/fixtures/**"] },
  {
    files: ["js/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...globals.browser, L: "readonly", Tesseract: "readonly", ...shared } },
    rules: {
      "no-undef": "error", "no-redeclare": "off", "no-const-assign": "error", "no-dupe-keys": "error", "no-dupe-else-if": "error", "no-unreachable": "error",
      "no-unsafe-finally": "error", "no-self-assign": "error", "no-sparse-arrays": "error", "use-isnan": "error", "valid-typeof": "error", "no-func-assign": "error",
      "no-cond-assign": ["error", "except-parens"], "no-empty": ["warn", { allowEmptyCatch: true }], "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-useless-escape": "warn", "no-fallthrough": "warn", "no-prototype-builtins": "warn",
    },
  },
  {
    files: ["js/routegeo.js"],   // wird auch von den Tests mit require() geladen
    languageOptions: { globals: { module: "writable" } },
  },
  {
    files: ["sw.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...globals.serviceworker } },
    rules: { "no-undef": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-empty": ["warn", { allowEmptyCatch: true }] },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser, ...shared, axe: "readonly" } },   // axe: wird in der Seite geladen (axe-core)
    rules: { "no-undef": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-empty": ["warn", { allowEmptyCatch: true }] },
  },
];
