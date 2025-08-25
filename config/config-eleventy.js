// @ts-ignore - eleventy does not support TypeScript
import { HtmlBasePlugin } from "@11ty/eleventy";
import { VERSION } from "svgo-ll";

// @ts-ignore - eleventy does not support TypeScript
export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("svgo_ll_version", VERSION);
  eleventyConfig.setInputDirectory("src");
  eleventyConfig.setOutputDirectory("public");
  eleventyConfig.setLayoutsDirectory("layouts/eleventy");
  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPlugin(HtmlBasePlugin, {
    baseHref: "/webopt",
  });
}
