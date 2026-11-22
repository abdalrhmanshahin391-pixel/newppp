export const BOOK_STEPS = ["read", "lessons", "review", "publish"] as const;
export type BookStep = (typeof BOOK_STEPS)[number];
