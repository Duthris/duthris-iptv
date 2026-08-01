"use client";

import * as React from "react";
import { tmdbImageUrl, type TmdbPerson } from "@iptv/core";
import { cn } from "@iptv/ui";

import { initialsOf } from "@/lib/format";

function CastFace({ person }: { person: TmdbPerson }) {
  const [failed, setFailed] = React.useState(false);
  const photo = tmdbImageUrl(person.profilePath, "w185");

  return (
    <li className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
      {photo && !failed ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="border-border/70 bg-surface-2 size-16 rounded-full border object-cover"
        />
      ) : (
        <span className="border-border/70 bg-surface-2 text-muted-foreground grid size-16 place-items-center rounded-full border text-xs font-semibold">
          {initialsOf(person.name)}
        </span>
      )}

      <span className="text-2xs text-foreground w-full truncate font-medium" title={person.name}>
        {person.name}
      </span>
      {person.character ? (
        <span className="text-2xs text-muted-foreground w-full truncate" title={person.character}>
          {person.character}
        </span>
      ) : null}
    </li>
  );
}

export interface CastStripProps {
  people: TmdbPerson[];
  className?: string;
}

export function CastStrip({ people, className }: CastStripProps) {
  if (people.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wide">
        Oyuncular
      </p>
      <ul className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1">
        {people.map((person) => (
          <CastFace key={`${person.name}:${person.character ?? ""}`} person={person} />
        ))}
      </ul>
    </div>
  );
}
