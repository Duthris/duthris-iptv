# Duthris IPTV

A desktop IPTV player for Windows. You bring your own M3U or Xtream Codes
playlist; the app is the player and library around it.

It ships no channels, hosts no content and talks to no server of its own.
Everything — profiles, favourites, watch history, the channel catalogue — stays
on the machine it runs on. There is no account and nothing to sign up for.

## What it does

**Live TV.** Categories, search, an EPG-aware channel list, number-key channel
entry, previous/next stepping and a return-to-last-channel shortcut. Playback
falls back from HLS to raw MPEG-TS automatically, because a fair number of
channels only serve one of the two.

**Films and series.** Virtualised poster grids over catalogues in the tens of
thousands, resume support, automatic next-episode playback, sorting and
filtering. Missing artwork and descriptions can be filled in from TMDB.

**TV guide.** XMLTV import with fuzzy channel matching, a scrollable timeline,
now/next on the live screen, per-day navigation, timezone selection and a
correction for feeds that publish timestamps without an offset.

**Plays what browsers cannot.** MKV and AVI containers, and AC-3, E-AC-3 or DTS
audio, are handed to a bundled FFmpeg and remuxed on the fly. Video is copied
whenever the browser can decode it, so the cost is usually just the audio track.
Embedded subtitles come out as WebVTT on a second output of the same FFmpeg
process; image-based subtitles are burned in instead.

**Player.** Aspect ratio, playback speed, audio track and subtitle selection,
subtitle styling, sleep timer, stream info, picture-in-picture, Media Session
integration for the OS media controls, and a screen wake lock.

**Library.** Per-profile favourites, watch history and continue-watching, with
encrypted backup and restore.

## Requirements

- Node.js 22+
- pnpm 11+

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs the web app on <http://localhost:3000>. To run the desktop
shell against it:

```bash
pnpm --filter @iptv/desktop dev
```

## Building

```bash
pnpm -w run verify       # typecheck, lint, build, desktop export
pnpm -w run package:win  # NSIS installer and portable exe in apps/desktop/release
```

Icons are generated from a single SVG and committed, so a normal build does not
need them regenerated:

```bash
pnpm -w run icons
```

## Configuration

Copy `apps/web/.env.example` to `apps/web/.env.local` if you want TMDB
enrichment baked into a build. It is optional, and the same token can be pasted
into the settings screen at runtime instead.

## Layout

```
apps/web        Next.js app. Deployed as a web build, and exported statically
                for the desktop shell.
apps/desktop    Electron main process, FFmpeg transcode server, credential
                storage.
packages/core   Framework-free parsers and clients: M3U, XMLTV, Xtream, TMDB.
packages/db     Dexie schema and repositories.
packages/ui     Design tokens and shared components.
packages/config TypeScript and ESLint bases.
```

Packages are consumed as source rather than built artefacts, via
`transpilePackages`.

## Notes on the web build

The web build exists and works, but it is the weaker of the two targets. A
browser cannot demux MKV, cannot reach HTTP streams from an HTTPS page, and has
no way around a DNS-level block on an image host. The desktop build solves all
three. Treat the browser as best effort.

## Scope

Deliberately not included: hosting or distributing any stream, proxying video
through a server, cloud sync, recording, and casting to external devices. The
`/api/proxy` route exists only for text and JSON — playlists, XMLTV and the
Xtream API — and rejects video and image content types.

## Licence

MIT. See [LICENSE](LICENSE).
