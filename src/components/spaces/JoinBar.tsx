// The way in with a code: one wide pill under the page's headline. It takes the bare code or the
// whole invite link, can paste from the clipboard, and says plainly what is wrong.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ClipboardPaste, KeyRound } from "lucide-react";

/** The invite code inside whatever was pasted: `7f3a9c2b1d` or `https://…/join/7f3a9c2b1d?x`. */
export function codeFrom(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const path = text.split(/[?#]/)[0] ?? "";
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return /^[a-z0-9_-]{4,64}$/i.test(last) ? last : null;
}

export function JoinBar() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canPaste, setCanPaste] = useState(false);

  useEffect(() => {
    setCanPaste(
      typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function",
    );
  }, []);

  function go() {
    if (!value.trim()) {
      setError("Paste the code or the invite link first.");
      input.current?.focus();
      return;
    }
    const code = codeFrom(value);
    if (!code) {
      setError("That doesn't look like an invite code or link. Check it and try again.");
      input.current?.focus();
      return;
    }
    setError(null);
    void navigate({ to: "/join/$code", params: { code } });
  }

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setError("There is nothing to paste yet. Copy the code or the link first.");
        return;
      }
      setValue(text);
      setError(null);
      input.current?.focus();
    } catch {
      setError("Your browser did not allow pasting. Press and hold the box, then choose Paste.");
    }
  }

  return (
    <form
      className="sp-join"
      aria-label="Join with an invite code"
      onSubmit={(event) => {
        event.preventDefault();
        go();
      }}
      noValidate
    >
      <div className={`sp-join-bar${error ? " is-error" : ""}`}>
        <KeyRound size={18} className="sp-join-icon" aria-hidden="true" />
        <label htmlFor="sp-join-code" className="sp-sr">
          Invite code or link
        </label>
        <input
          id="sp-join-code"
          ref={input}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Invite code or link"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={error ? true : undefined}
          aria-describedby="sp-join-note"
        />
        {canPaste && !value && (
          <button
            type="button"
            className="sp-btn sp-btn-ghost sp-btn-sm sp-join-paste"
            onClick={paste}
          >
            <ClipboardPaste size={15} aria-hidden="true" />
            Paste
          </button>
        )}
        <button type="submit" className="sp-btn sp-btn-dark sp-join-go">
          Join
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p
        id="sp-join-note"
        className={`sp-join-note${error ? " sp-join-error" : ""}`}
        role={error ? "alert" : undefined}
      >
        {error ?? (
          <>
            A code like <code>7f3a9c2b1d</code> or a link like{" "}
            <code>ritajet.com/join/7f3a9c2b1d</code>
          </>
        )}
      </p>
    </form>
  );
}
