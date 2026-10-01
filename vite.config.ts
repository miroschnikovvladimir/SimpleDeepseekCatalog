import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();

export default defineConfig({ base: "./", plugins: [react()], define: { __BUILD_SHA__: JSON.stringify(commit) }, build: { target: "es2022" } });
