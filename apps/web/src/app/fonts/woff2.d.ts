// Importing a font file gives its public, content-hashed URL (Turbopack's static asset import).
declare module '*.woff2' {
  const url: string;
  export default url;
}
