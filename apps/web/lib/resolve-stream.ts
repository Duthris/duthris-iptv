"use client";

import {
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
