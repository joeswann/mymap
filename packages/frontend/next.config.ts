/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  sassOptions: {
    additionalData: `@use "src/styles/_helpers.scss" as *; @use "src/styles/_variables.scss" as *;`,
  },

  transpilePackages: ["@app/common"],
};

export default nextConfig;
