/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  sassOptions: {
    additionalData: `@use "src/styles/_helpers.scss" as *;`,
  },

  transpilePackages: ["@app/common"],
};

export default nextConfig;
