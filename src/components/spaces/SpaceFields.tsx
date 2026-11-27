// The four things that make a classroom or group recognisable: its name, a line about it, an emoji
// and a colour. Used when making one and in its settings.
import { useId } from "react";
import { SPACE_COLORS, type SpaceKind } from "@/lib/spaces";
import { COLOR_LABEL, SPACE_EMOJIS } from "./shared";

export type SpaceDraft = { name: string; description: string; emoji: string; color: string };

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 240;

export function SpaceFields({
  kind,
  value,
  onChange,
  nameError,
  autoFocus = false,
}: {
  kind: SpaceKind;
  value: SpaceDraft;
  onChange: (next: SpaceDraft) => void;
  nameError?: string | null;
  autoFocus?: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<SpaceDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="sp-fields">
      <div className="sp-field">
        <label className="sp-label" htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          className="sp-input"
          value={value.name}
          maxLength={NAME_MAX}
          placeholder={kind === "classroom" ? "Year 3 · Cardiology" : "Heart failure squad"}
          onChange={(event) => set({ name: event.target.value })}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          autoComplete="off"
          data-autofocus={autoFocus ? "" : undefined}
          dir="auto"
        />
        <div className="sp-field-foot">
          {nameError ? (
            <p id={`${id}-name-error`} className="sp-field-error" role="alert">
              {nameError}
            </p>
          ) : (
            <span />
          )}
          <span className="sp-count">
            {value.name.length}/{NAME_MAX}
          </span>
        </div>
      </div>

      <div className="sp-field">
        <label className="sp-label" htmlFor={`${id}-about`}>
          About <span className="sp-optional">optional</span>
        </label>
        <textarea
          id={`${id}-about`}
          className="sp-input sp-textarea"
          value={value.description}
          maxLength={DESCRIPTION_MAX}
          placeholder={
            kind === "classroom"
              ? "Weekly decks for the cardiology block, exam questions and news from Dr. Sami."
              : "Five of us revising heart failure before the finals."
          }
          onChange={(event) => set({ description: event.target.value })}
          dir="auto"
        />
        <div className="sp-field-foot">
          <span />
          <span className="sp-count">
            {value.description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
      </div>

      <fieldset className="sp-field">
        <legend className="sp-label">Emoji</legend>
        <div className="sp-emojis">
          {SPACE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={value.emoji === emoji}
              aria-label={`Use ${emoji}`}
              onClick={() => set({ emoji })}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="sp-field">
        <legend className="sp-label">Colour</legend>
        <div className="sp-colors">
          {Object.entries(SPACE_COLORS).map(([key, tone]) => (
            <button
              key={key}
              type="button"
              aria-pressed={value.color === key}
              aria-label={COLOR_LABEL[key] ?? key}
              title={COLOR_LABEL[key] ?? key}
              style={{ background: `linear-gradient(135deg, ${tone.from}, ${tone.to})` }}
              onClick={() => set({ color: key })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
