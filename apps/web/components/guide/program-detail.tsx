"use client";

import { Clock, Play, Radio, Tag } from "lucide-react";
import type { EpgProgram } from "@iptv/core";
import { Badge, Button } from "@iptv/ui";

import { DetailOverlay } from "@/components/library/detail-overlay";
import { useGuideTime } from "@/lib/use-guide-time";
import { formatDuration } from "@/lib/format";

export interface ProgramDetailProps {
  program: EpgProgram | null;
  channelName: string;
  onClose: () => void;
  onWatch: () => void;
}

export function ProgramDetail({ program, channelName, onClose, onWatch }: ProgramDetailProps) {
  const { formatTime, formatDate, shiftMs } = useGuideTime();

  const start = program ? program.start + shiftMs : 0;
  const stop = program ? program.stop + shiftMs : 0;
  const airing = program ? start <= Date.now() && stop > Date.now() : false;

  return (
    <DetailOverlay open={Boolean(program)} onClose={onClose} className="max-w-xl">
      {program ? (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2 pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">
                <Radio /> {channelName}
              </Badge>
              {airing ? <Badge variant="live">ŞİMDİ</Badge> : null}
            </div>

            <h2 className="text-foreground text-lg font-semibold leading-tight tracking-tight">
              {program.title}
            </h2>

            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <span className="tabular flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {formatTime(start)} – {formatTime(stop)}
              </span>
              <span className="tabular">{formatDuration((stop - start) / 1000)}</span>
              <span>{formatDate(start)}</span>
              {program.category ? (
                <span className="flex items-center gap-1.5">
                  <Tag className="size-3.5" />
                  {program.category}
                </span>
              ) : null}
            </div>
          </div>

          {program.desc ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{program.desc}</p>
          ) : (
            <p className="text-muted-foreground text-sm">Bu program için açıklama yok.</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={onWatch}>
              <Play /> Kanalı aç
            </Button>
          </div>
        </div>
      ) : null}
    </DetailOverlay>
  );
}
