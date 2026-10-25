import assert from "node:assert/strict";
import test from "node:test";
import { isImageRejection, VISION_CHECK_JPEG_BASE64 } from "./vision-check-image.ts";

test("the check image is a complete JPEG (start marker, end marker, real size)", () => {
  const bytes = Buffer.from(VISION_CHECK_JPEG_BASE64, "base64");
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9]);
  assert.ok(bytes.length > 500);
  // Baseline (FFC0), not progressive (FFC2): the strictest decoders accept it.
  const hex = bytes.toString("hex");
  assert.ok(hex.includes("ffc0") && !hex.includes("ffc2"));
});

test("only a refused picture counts as an image problem", () => {
  assert.equal(
    isImageRejection(
      "OpenAI 400: You uploaded an unsupported image. Please make sure your image is valid.",
    ),
    true,
  );
  assert.equal(isImageRejection("OpenAI 401: Incorrect API key provided"), false);
  assert.equal(isImageRejection("OpenAI 429: You exceeded your current quota"), false);
  assert.equal(isImageRejection("OpenAI 404: The model gpt-x does not exist"), false);
});
