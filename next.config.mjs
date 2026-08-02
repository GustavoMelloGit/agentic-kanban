/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // sem isto o Next acha um package-lock.json acima do projeto e traça o build
  // a partir do $HOME
  outputFileTracingRoot: import.meta.dirname,
};
export default nextConfig;
