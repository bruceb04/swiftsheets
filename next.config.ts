import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/").pop();
const isGithubPagesBuild = process.env.GITHUB_ACTIONS === "true" && repoName;
const isUserOrOrgPagesRepo = repoName?.endsWith(".github.io");
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (isGithubPagesBuild && !isUserOrOrgPagesRepo ? `/${repoName}` : "");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
