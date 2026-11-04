import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { LanguageProvider, useLang } from "./LanguageProvider";
import { createUiI18n } from "../i18n";
import { VoiceOrb } from "./rita-live/VoiceOrb";

function Probe() {
  const { lang } = useLang();
  const { i18n } = useTranslation();
  return (
    <span>
      {lang}:{i18n.language}
    </span>
  );
}

test("Arabic and English SSR providers and translations agree on the first render", () => {
  assert.equal(
    renderToString(
      <LanguageProvider initialLang="ar">
        <Probe />
      </LanguageProvider>,
    ),
    "<span>ar<!-- -->:<!-- -->ar</span>",
  );
  assert.equal(
    renderToString(
      <LanguageProvider initialLang="en">
        <Probe />
      </LanguageProvider>,
    ),
    "<span>en<!-- -->:<!-- -->en</span>",
  );
});

test("changing one app's locale cannot contaminate another SSR request", async () => {
  const arabic = createUiI18n("ar");
  const english = createUiI18n("en");
  assert.equal(arabic.language, "ar");
  assert.equal(english.language, "en");
  await english.changeLanguage("ar");
  await arabic.changeLanguage("en");
  assert.equal(english.language, "ar");
  assert.equal(arabic.language, "en");
});

test("the voice orb has a visible SSR fallback before WebGL starts", () => {
  const html = renderToString(
    <VoiceOrb levelsRef={{ current: { input: 0, output: 0 } }} mode="idle" />,
  );
  assert.match(html, /radial-gradient/);
  assert.match(html, /<canvas/);
});
