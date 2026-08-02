"use client";

import {
  buildTimeshiftUrl,
  parseXtreamCredentials,
  resolveEpisodeStream,
  resolveLiveStream,
  resolveVodStream,
  type PlaybackContext,
  type PlaylistSource,
  type ResolvedStream,
  type SourceRuntime,
  type StreamFormat,
} from "@iptv/core";
import { getEpisode, getLiveChannel, getSource, getVodItem, readCredential } from "@iptv/db";

import { getDesktopBridge, isDesktop, isHttpsPage } from "./platform";

const credentialCache = new Map<string, string>();

async function readCachedCredential(ref: string | null): Promise<string | null> {
  if (!ref) return null;
  const cached = credentialCache.get(ref);
  if (cached !== undefined) return cached;

  const secret = await readCredential(ref);
  if (secret) credentialCache.set(ref, secret);
  return secret;
}

export function currentPlaybackContext(): PlaybackContext {
  return { pageIsSecure: isHttpsPage(), isDesktop: isDesktop() };
}

async function resolveFor(
  source: PlaylistSource,
  build: (runtime: SourceRuntime) => ResolvedStream | null,
): Promise<ResolvedStream | null> {
  const context = currentPlaybackContext();

  if (source.kind !== "xtream") {
    return build({ source, credentials: null, context });
  }
  if (!source.username) return null;

  const bridge = getDesktopBridge();

  if (bridge && source.credentialRef) {
    const template = build({
      source,
      credentials: parseXtreamCredentials(source.url, {
        username: source.username,
        password: bridge.secretPlaceholder,
      }),
      context,
    });
    if (!template) return null;

    const url = await bridge.resolveStreamUrl(source.credentialRef, template.url);
    return url ? { ...template, url } : null;
  }

  const password = await readCachedCredential(source.credentialRef);
  if (!password) return null;

  try {
    const credentials = parseXtreamCredentials(source.url, {
      username: source.username,
      password,
    });
    return build({ source, credentials, context });
  } catch {
    return null;
  }
}

export async function resolveChannelStream(
  channelId: string,
  preferredFormat?: StreamFormat,
): Promise<ResolvedStream | null> {
  const channel = await getLiveChannel(channelId);
  if (!channel) return null;

  const source = await getSource(channel.sourceId);
  if (!source) return null;

  return resolveFor(source, (runtime) => resolveLiveStream(channel, runtime, preferredFormat));
}

export async function resolveMovieStream(vodId: string): Promise<ResolvedStream | null> {
  const item = await getVodItem(vodId);
  if (!item) return null;

  const source = await getSource(item.sourceId);
  if (!source) return null;

  return resolveFor(source, (runtime) => resolveVodStream(item, runtime));
}

export async function resolveEpisodeStreamUrl(episodeId: string): Promise<ResolvedStream | null> {
  const episode = await getEpisode(episodeId);
  if (!episode) return null;

  const source = await getSource(episode.sourceId);
  if (!source) return null;

  return resolveFor(source, (runtime) => resolveEpisodeStream(episode, runtime));
}

export function clearCredentialCache(): void {
  credentialCache.clear();
}

export interface StreamTemplate {
  /** Holds the bridge placeholder where the password belongs. */
  urlTemplate: string;
  credentialRef: string | null;
}

/**
 * The address an external player should be handed.
 *
 * Unlike the functions above this stops before the secret is filled in: the
 * main process does that as it launches, so the password never appears in a
 * command line assembled here. Desktop only, since that substitution is the
 * bridge's to make.
 */
async function templateFor(
  source: PlaylistSource,
  build: (runtime: SourceRuntime) => ResolvedStream | null,
): Promise<StreamTemplate | null> {
  const context = currentPlaybackContext();
  const bridge = getDesktopBridge();
  if (!bridge) return null;

  if (source.kind !== "xtream") {
    const plain = build({ source, credentials: null, context });
    return plain ? { urlTemplate: plain.url, credentialRef: null } : null;
  }

  if (!source.username || !source.credentialRef) return null;

  try {
    const built = build({
      source,
      credentials: parseXtreamCredentials(source.url, {
        username: source.username,
        password: bridge.secretPlaceholder,
      }),
      context,
    });
    return built ? { urlTemplate: built.url, credentialRef: source.credentialRef } : null;
  } catch {
    return null;
  }
}

export async function channelStreamTemplate(channelId: string): Promise<StreamTemplate | null> {
  const channel = await getLiveChannel(channelId);
  if (!channel) return null;

  const source = await getSource(channel.sourceId);
  if (!source) return null;

  return templateFor(source, (runtime) => resolveLiveStream(channel, runtime));
}

export async function movieStreamTemplate(vodId: string): Promise<StreamTemplate | null> {
  const item = await getVodItem(vodId);
  if (!item) return null;

  const source = await getSource(item.sourceId);
  if (!source) return null;

  return templateFor(source, (runtime) => resolveVodStream(item, runtime));
}

export async function episodeStreamTemplate(episodeId: string): Promise<StreamTemplate | null> {
  const episode = await getEpisode(episodeId);
  if (!episode) return null;

  const source = await getSource(episode.sourceId);
  if (!source) return null;

  return templateFor(source, (runtime) => resolveEpisodeStream(episode, runtime));
}

export async function resolveArchiveStream(
  channelId: string,
  startAt: Date,
  durationMinutes: number,
): Promise<ResolvedStream | null> {
  const channel = await getLiveChannel(channelId);
  if (!channel || channel.streamId === null) return null;

  const source = await getSource(channel.sourceId);
  if (!source || source.kind !== "xtream") return null;

  return resolveFor(source, ({ credentials }) => {
    if (!credentials) return null;
    return {
      url: buildTimeshiftUrl(credentials, channel.streamId!, startAt, durationMinutes),
      kind: "mpegts",
      insecure: credentials.baseUrl.startsWith("http://"),
    };
  });
}
