"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileUp, KeyRound, Link2, Sparkles, UploadCloud, X } from "lucide-react";
import type { ParseProgress, SourceStats } from "@iptv/core";
import { Button, FieldHint, Input, Label, cn } from "@iptv/ui";

import { SegmentedControl } from "@/components/playlist/segmented-control";
import { ImportProgress, ImportSuccess } from "@/components/playlist/import-progress";
import { importM3UFile, importM3UUrl, importXtream } from "@/lib/import/import-source";
import { usePlaylistStore } from "@/stores/playlist-store";
import { formatBytes } from "@/lib/format";
import {
  MAX_M3U_FILE_BYTES,
  detectXtreamFromUrl,
  fieldErrorsOf,
  m3uFileFormSchema,
  m3uUrlFormSchema,
  suggestNameFromUrl,
  xtreamFormSchema,
} from "@/lib/validation";

type Mode = "m3u-url" | "m3u-file" | "xtream";

const MODES = [
  { value: "m3u-url" as const, label: "M3U Bağlantı", icon: Link2 },
  { value: "m3u-file" as const, label: "M3U Dosya", icon: FileUp },
  { value: "xtream" as const, label: "Xtream", icon: KeyRound },
];

export interface AddPlaylistFormProps {
  variant?: "onboarding" | "settings";
  onDone?: (sourceId: string) => void;
  className?: string;
}

export function AddPlaylistForm({ variant = "settings", onDone, className }: AddPlaylistFormProps) {
  const router = useRouter();
  const refreshSources = usePlaylistStore((state) => state.refresh);

  const [mode, setMode] = React.useState<Mode>("m3u-url");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<ParseProgress | null>(null);
  const [result, setResult] = React.useState<{ name: string; stats: SourceStats } | null>(null);

  const [urlName, setUrlName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [urlNameTouched, setUrlNameTouched] = React.useState(false);

  const [file, setFile] = React.useState<{ name: string; size: number; content: string } | null>(
    null,
  );
  const [fileName, setFileName] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [xtName, setXtName] = React.useState("");
  const [host, setHost] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [xtNameTouched, setXtNameTouched] = React.useState(false);

  const xtreamHint = React.useMemo(() => detectXtreamFromUrl(url), [url]);

  const switchToXtream = () => {
    if (!xtreamHint) return;
    setHost(xtreamHint.baseUrl);
    setUsername(xtreamHint.username);
    setPassword(xtreamHint.password);
    if (!xtNameTouched) setXtName(suggestNameFromUrl(xtreamHint.baseUrl));
    setMode("xtream");
    setErrors({});
    setFormError(null);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (!urlNameTouched && value.trim()) setUrlName(suggestNameFromUrl(value));
  };

  const handleHostChange = (value: string) => {
    setHost(value);
    const detected = detectXtreamFromUrl(value);
    if (detected) {
      setHost(detected.baseUrl);
      setUsername(detected.username);
      setPassword(detected.password);
      if (!xtNameTouched) setXtName(suggestNameFromUrl(detected.baseUrl));
      toast.success("Bağlantıdan giriş bilgileri alındı");
    } else if (!xtNameTouched && value.trim()) {
      setXtName(suggestNameFromUrl(value));
    }
  };

  const readFile = async (picked: File) => {
    if (picked.size > MAX_M3U_FILE_BYTES) {
      setFormError(
        `Dosya çok büyük (${formatBytes(picked.size)}). En fazla ${formatBytes(MAX_M3U_FILE_BYTES)} destekleniyor.`,
      );
      return;
    }
    setFormError(null);
    const content = await picked.text();
    setFile({ name: picked.name, size: picked.size, content });
    setFileName((current) => current || picked.name.replace(/\.(m3u8?|txt)$/i, ""));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void readFile(dropped);
  };

  const onProgress = React.useCallback((next: ParseProgress) => setProgress(next), []);

  const currentName = mode === "m3u-url" ? urlName : mode === "m3u-file" ? fileName : xtName;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setResult(null);

    try {
      setBusy(true);
      setProgress(null);

      let outcome: { sourceId: string; stats: SourceStats; warnings: string[] };
      let displayName: string;

      if (mode === "m3u-url") {
        const parsed = m3uUrlFormSchema.safeParse({ name: urlName, url });
        if (!parsed.success) {
          setErrors(fieldErrorsOf(parsed.error));
          return;
        }
        displayName = parsed.data.name;
        outcome = await importM3UUrl(parsed.data, { onProgress });
      } else if (mode === "m3u-file") {
        const parsed = m3uFileFormSchema.safeParse({
          name: fileName,
          content: file?.content ?? "",
        });
        if (!parsed.success) {
          setErrors(fieldErrorsOf(parsed.error));
          if (!file) setFormError("Önce bir M3U dosyası seçin");
          return;
        }
        displayName = parsed.data.name;
        outcome = await importM3UFile(parsed.data, { onProgress });
      } else {
        const parsed = xtreamFormSchema.safeParse({ name: xtName, host, username, password });
        if (!parsed.success) {
          setErrors(fieldErrorsOf(parsed.error));
          return;
        }
        displayName = parsed.data.name;
        outcome = await importXtream(
          {
            name: parsed.data.name,
            baseUrl: parsed.data.host,
            username: parsed.data.username,
            password: parsed.data.password,
          },
          { onProgress },
        );
      }

      await refreshSources();
      setResult({ name: displayName, stats: outcome.stats });

      for (const warning of outcome.warnings) {
        toast.warning("Kaynakta beklenmeyen veri", { description: warning });
      }

      toast.success(`${displayName} eklendi`);
      onDone?.(outcome.sourceId);

      if (variant === "onboarding") {
        setTimeout(() => router.push("/live"), 1400);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Playlist eklenemedi");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (result) {
    return (
      <div className={cn("flex flex-col gap-5", className)}>
        <ImportSuccess sourceName={result.name} stats={result.stats} />
        {variant === "settings" ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push("/live")}>Canlı TV&apos;yi aç</Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setUrl("");
                setUrlName("");
                setFile(null);
                setFileName("");
                setUrlNameTouched(false);
              }}
            >
              Başka playlist ekle
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Canlı TV&apos;ye yönlendiriliyorsunuz…</p>
        )}
      </div>
    );
  }

  if (busy) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <ImportProgress progress={progress} sourceName={currentName || "Playlist"} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-5", className)} noValidate>
      <SegmentedControl
        options={MODES}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setErrors({});
          setFormError(null);
        }}
        aria-label="Playlist kaynağı türü"
      />

      {mode === "m3u-url" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="m3u-url">M3U bağlantısı</Label>
            <Input
              id="m3u-url"
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder="https://ornek.com/get.php?username=...&password=..."
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
              invalid={Boolean(errors.url)}
              icon={<Link2 />}
            />
            <FieldHint error={Boolean(errors.url)}>
              {errors.url ?? "Sağlayıcınızın verdiği M3U / M3U-plus adresini yapıştırın."}
            </FieldHint>
          </div>

          {xtreamHint ? (
            <div className="border-brand-500/25 bg-brand-surface flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
              <Sparkles className="text-primary size-4 shrink-0" />
              <p className="text-foreground flex-1 text-sm leading-relaxed">
                Bu bir <strong className="font-semibold">Xtream</strong> bağlantısı. Xtream modunda
                kategoriler, film/dizi ayrımı ve EPG hazır geldiği için sonuç daha iyi olur.
              </p>
              <Button type="button" size="sm" onClick={switchToXtream} className="shrink-0">
                Xtream olarak ekle
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="m3u-url-name">Playlist adı</Label>
            <Input
              id="m3u-url-name"
              value={urlName}
              onChange={(event) => {
                setUrlName(event.target.value);
                setUrlNameTouched(true);
              }}
              placeholder="Örn. Ana Playlist"
              invalid={Boolean(errors.name)}
            />
            <FieldHint error={Boolean(errors.name)}>{errors.name}</FieldHint>
          </div>
        </div>
      ) : null}

      {mode === "m3u-file" ? (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
              "duration-base ease-brand transition-colors",
              dragging
                ? "border-brand-500 bg-brand-500/[0.07]"
                : "border-border bg-surface-2/50 hover:border-brand-500/40",
            )}
          >
            <span className="bg-surface-3 text-muted-foreground grid size-11 place-items-center rounded-full">
              <UploadCloud className="size-5" />
            </span>

            {file ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-foreground text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">{formatBytes(file.size)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={() => setFile(null)}
                >
                  <X /> Kaldır
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <p className="text-foreground text-sm font-medium">Dosyayı buraya sürükleyin</p>
                <p className="text-muted-foreground text-xs">.m3u veya .m3u8 · en fazla 200 MB</p>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Dosya seç
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".m3u,.m3u8,text/plain"
              className="sr-only"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) void readFile(picked);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="m3u-file-name">Playlist adı</Label>
            <Input
              id="m3u-file-name"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="Örn. Yedek Playlist"
              invalid={Boolean(errors.name)}
            />
            <FieldHint error={Boolean(errors.name || errors.content)}>
              {errors.name ?? errors.content}
            </FieldHint>
          </div>
        </div>
      ) : null}

      {mode === "xtream" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="xt-host">Sunucu adresi</Label>
            <Input
              id="xt-host"
              value={host}
              onChange={(event) => handleHostChange(event.target.value)}
              placeholder="http://ornek.com:8080"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
              invalid={Boolean(errors.host)}
            />
            <FieldHint error={Boolean(errors.host)}>
              {errors.host ??
                "Tam M3U bağlantınızı da yapıştırabilirsiniz — kullanıcı adı ve parola otomatik doldurulur."}
            </FieldHint>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="xt-user">Kullanıcı adı</Label>
              <Input
                id="xt-user"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                invalid={Boolean(errors.username)}
              />
              <FieldHint error={Boolean(errors.username)}>{errors.username}</FieldHint>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="xt-pass">Parola</Label>
              <Input
                id="xt-pass"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                invalid={Boolean(errors.password)}
              />
              <FieldHint error={Boolean(errors.password)}>{errors.password}</FieldHint>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="xt-name">Playlist adı</Label>
            <Input
              id="xt-name"
              value={xtName}
              onChange={(event) => {
                setXtName(event.target.value);
                setXtNameTouched(true);
              }}
              placeholder="Örn. Ana Hesap"
              invalid={Boolean(errors.name)}
            />
            <FieldHint error={Boolean(errors.name)}>{errors.name}</FieldHint>
          </div>
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/[0.07] flex items-start gap-3 rounded-lg border p-4"
        >
          <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
          <p className="text-foreground text-sm leading-relaxed">{formError}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Verileriniz yalnızca bu cihazda saklanır. Hesap açmanıza gerek yok.
        </p>
        <Button type="submit" size="lg" className="sm:min-w-40">
          {variant === "onboarding" ? "Ekle ve başla" : "Playlist ekle"}
        </Button>
      </div>
    </form>
  );
}
