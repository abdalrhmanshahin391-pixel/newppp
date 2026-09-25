import { useSyncExternalStore } from "react";
import {
  subscribeAuth,
  getAuthSnapshot,
  getAuthServerSnapshot,
  refreshAuthProfile,
  type Profile,
} from "@/lib/auth-store";

export { refreshAuthProfile };
export type { Profile };

export function useAuth() {
  const auth = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);

  return {
    session: auth.session,
    user: auth.user,
    profile: auth.profile,
    isAdmin: auth.isRealAdmin,
    isRealAdmin: auth.isRealAdmin,
    isGolden: auth.isGolden,
    isCommittee: auth.isCommittee,
    isCommitteeHead: auth.isCommitteeHead,
    loading: auth.loading,
  };
}
