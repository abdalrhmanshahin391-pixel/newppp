// One classroom or group in "Your spaces": its mark, kind and your role, the name and a line about
// it, then members and decks. The same face is used for the live preview while making one.
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Layers, Users } from "lucide-react";
import { KIND_LABEL, type MySpace } from "@/lib/spaces";
import { RoleChip } from "./MemberRow";
import { SpaceMark } from "./shared";

export const plural = (n: number, word: string) =>
  `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;

type CardData = Pick<
  MySpace,
  "kind" | "name" | "description" | "emoji" | "color" | "role" | "members" | "decks"
>;

function CardFace({ space }: { space: CardData }) {
  return (
    <>
      <div className="sp-card-top">
        <SpaceMark color={space.color} emoji={space.emoji} size={52} />
        <div className="sp-card-tags">
          <span className="sp-chip">{KIND_LABEL[space.kind]}</span>
          <RoleChip role={space.role} />
        </div>
      </div>
      <h3 className="sp-card-name" dir="auto">
        {space.name.trim() || "Untitled"}
      </h3>
      <p
        className={`sp-card-desc${space.description?.trim() ? "" : " sp-card-desc-empty"}`}
        dir="auto"
      >
        {space.description?.trim() || "No description yet."}
      </p>
      <div className="sp-card-foot">
        <span>
          <Users size={15} aria-hidden="true" />
          {plural(space.members, "member")}
        </span>
        <span>
          <Layers size={15} aria-hidden="true" />
          {plural(space.decks, "deck")}
        </span>
        <span className="sp-card-go" aria-hidden="true">
          <ArrowUpRight size={16} />
        </span>
      </div>
    </>
  );
}

export function SpaceCard({ space }: { space: MySpace }) {
  return (
    <Link to="/spaces/$spaceId" params={{ spaceId: space.id }} className="sp-card">
      <CardFace space={space} />
    </Link>
  );
}

/** The card as it will look, while it is being made (not a link). */
export function SpaceCardPreview({ space }: { space: CardData }) {
  return (
    <div className="sp-card sp-card-static" aria-hidden="true">
      <CardFace space={space} />
    </div>
  );
}

export function SpaceCardSkeleton() {
  return (
    <div className="sp-card sp-card-skel" aria-hidden="true">
      <div className="sp-card-top">
        <span className="sp-bone sp-bone-mark" />
        <span className="sp-bone sp-bone-chip" />
      </div>
      <span className="sp-bone sp-bone-title" />
      <span className="sp-bone sp-bone-line" />
      <span className="sp-bone sp-bone-line sp-bone-short" />
      <div className="sp-card-foot">
        <span className="sp-bone sp-bone-chip" />
      </div>
    </div>
  );
}
