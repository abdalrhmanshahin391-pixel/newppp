/** Google sign-in as a plain button. */
export function GoogleButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full border border-black bg-white p-2 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
