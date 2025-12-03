const Bytez = require("bytez.js");

const key = "066fe640799a7df73d7dfe1cb9a6060c";
const sdk = new Bytez(key);

/**
 * Analyzes an image URL and returns a description
 * @param {string} imageUrl - The URL of the image to analyze
 * @returns {Promise<{error: any, output: string}>}
 */
async function analyzeImage(imageUrl) {
  try {
    const model = sdk.model("Salesforce/blip2-flan-t5-xl");
    const result = await model.run(imageUrl);
    return result;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return { error, output: null };
  }
}

module.exports = { analyzeImage };