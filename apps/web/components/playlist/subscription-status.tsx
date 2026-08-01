"use client";

import * as React from "react";
import { AlertTriangle, CalendarClock, Users } from "lucide-react";
import type { SourceSubscription } from "@iptv/core";
import { Badge, cn } from "@iptv/ui";

import { formatRelative } from "@/lib/format";

const DAY_MS = 86_400_000;

const WARN_DAYS = 7;

export function daysUntilExpiry(subscription: SourceSubscription | null): number | null {
  if (!subscription?.expiresAt) return null;
  return Math.floor((subscription.expiresAt - Date.now()) / DAY_MS);
}

export function expiryTone(days: number | null): "expired" | "warning" | "ok" | null {
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= WARN_DAYS) return "warning";
  return "ok";
}

function expiryLabel(subscription: SourceSubscription): string {
  const days = daysUntilExpiry(subscription);
  if (days === null) return "Süresiz";
  if (days < 0) return "Süresi doldu";
  if (days === 0) return "Bugün doluyor";
  if (days === 1) return "Yarın doluyor";
  return `${days} gün kaldı`;
}

export interface SubscriptionStatusProps {
  subscription: SourceSubscription | null;
  className?: string;
}

export function SubscriptionStatus({ subscription, className }: SubscriptionStatusProps) {
  if (!subscription) return null;

  const days = daysUntilExpiry(subscription);
  const tone = expiryTone(days);
  const date = subscription.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            tone === "expired" ? "destructive" : tone === "warning" ? "warning" : "outline"
          }
        >
          <CalendarClock /> {expiryLabel(subscription)}
        </Badge>

        <Badge variant="outline">
          <Users /> {subscription.activeConnections} / {subscription.maxConnections} bağlantı
        </Badge>

        {subscription.isTrial ? <Badge variant="warning">Deneme</Badge> : null}

        {subscription.status && subscription.status.toLowerCase() !== "active" ? (
          <Badge variant="destructive">{subscription.status}</Badge>
        ) : null}
      </div>

      <p className="text-2xs text-muted-foreground">
        {date ? `Bitiş: ${date} · ` : ""}
        {formatRelative(subscription.checkedAt)} kontrol edildi
      </p>

      {tone === "expired" || tone === "warning" ? (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-3",
            tone === "expired"
              ? "border-destructive/30 bg-destructive/[0.07]"
              : "border-warning/30 bg-warning/[0.07]",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              tone === "expired" ? "text-destructive" : "text-warning",
            )}
          />
          <p className="text-xs leading-relaxed text-foreground">
            {tone === "expired"
              ? "Bu kaynağın aboneliği sona ermiş görünüyor. Kanallar açılmayabilir; sağlayıcınızdan yenilemeniz gerekir."
              : "Bu kaynağın aboneliği yakında sona eriyor. Yenilenmezse kanallar açılmayı bırakır."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
