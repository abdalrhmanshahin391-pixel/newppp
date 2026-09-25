import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { openAuth } from "@/lib/auth-dialog";

export function StartLearningLink({
  className,
  children = "Start learning",
  onOpen,
}: {
  className?: string;
  children?: React.ReactNode;
  onOpen?: () => void;
}) {
  const { user, loading } = useAuth();

  if (user) {
    return (
      <Link to="/learn" className={className} onClick={onOpen}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      className={className}
      onClick={() => {
        onOpen?.();
        openAuth("signin", "/learn");
      }}
    >
      {children}
    </button>
  );
}