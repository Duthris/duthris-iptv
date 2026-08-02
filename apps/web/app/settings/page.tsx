"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpCircle,
  CalendarClock,
  Database,
  Download,
  HardDrive,
  Lock,
  MonitorCog,
  MonitorPlay,
  RefreshCw,
  Sparkles,
  Captions,
  ShieldCheck,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  clearTmdbCache,
  countTmdbCache,
  createBackup,
  eraseAllData,
  estimateStorage,
  parseBackupFile,
  requestPersistentStorage,
  restoreBackup,
  type BackupFile,
  type StorageEstimate,
} from "@iptv/db";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldHint,
  Input,
  Label,
  Select,
  cn,
} from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { DesktopShellSettings } from "@/components/settings/desktop-shell";
import { GUIDE_TIME_ZONES } from "@/lib/use-guide-time";
import { useUpdater } from "@/lib/use-updater";
import { hasBuildTimeOpenSubtitlesKey } from "@/lib/opensubtitles";
import { hasBuildTimeTmdbToken } from "@/lib/tmdb";
import { usePlaylistStore } from "@/stores/playlist-store";
import { useProfileStore } from "@/stores/profile-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatBytes, formatCount } from "@/lib/format";

const REFRESH_OPTIONS = [
  { value: 0, label: "Kapalı" },
  { value: 6, label: "6 saatte bir" },
  { value: 12, label: "12 saatte bir" },
  { value: 24, label: "Günde bir" },
  { value: 48, label: "2 günde bir" },
];

const FONT_SCALE_OPTIONS = [
  { value: 0.9, label: "Küçük" },
  { value: 1, label: "Normal" },
  { value: 1.1, label: "Büyük" },
  { value: 1.25, label: "Çok büyük" },
];

const GUIDE_SHIFT_OPTIONS = [-180, -120, -60, 0, 60, 120, 180];

const LANGUAGE_OPTIONS = [
  { value: "tur", label: "Türkçe" },
  { value: "eng", label: "İngilizce" },
  { value: "ger", label: "Almanca" },
  { value: "fre", label: "Fransızca" },
  { value: "spa", label: "İspanyolca" },
  { value: "ita", label: "İtalyanca" },
  { value: "rus", label: "Rusça" },
  { value: "ara", label: "Arapça" },
  { value: "jpn", label: "Japonca" },
  { value: "kor", label: "Korece" },
];

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <Card className={cn("p-6", tone === "danger" && "border-destructive/30")}>
      <CardHeader className="p-0">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center self-start rounded-md",
            tone === "danger"
              ? "bg-destructive/15 text-destructive"
              : "bg-surface-3 text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const sources = usePlaylistStore((state) => state.sources);
  const refreshSources = usePlaylistStore((state) => state.refresh);
  const refreshProfiles = useProfileStore((state) => state.refresh);
  const autoRefreshHours = useSettingsStore((state) => state.autoRefreshHours);
  const setAutoRefreshHours = useSettingsStore((state) => state.setAutoRefreshHours);
  const showAdult = useSettingsStore((state) => state.showAdultCategories);
  const setShowAdult = useSettingsStore((state) => state.setShowAdultCategories);
  const preferredAudioLang = useSettingsStore((state) => state.preferredAudioLang);
  const setPreferredAudioLang = useSettingsStore((state) => state.setPreferredAudioLang);
  const preferredSubtitleLang = useSettingsStore((state) => state.preferredSubtitleLang);
  const setPreferredSubtitleLang = useSettingsStore((state) => state.setPreferredSubtitleLang);
  const keepScreenAwake = useSettingsStore((state) => state.keepScreenAwake);
  const setKeepScreenAwake = useSettingsStore((state) => state.setKeepScreenAwake);
  const tmdbToken = useSettingsStore((state) => state.tmdbToken);
  const setTmdbToken = useSettingsStore((state) => state.setTmdbToken);
  const tmdbEnabled = useSettingsStore((state) => state.tmdbEnabled);
  const setTmdbEnabled = useSettingsStore((state) => state.setTmdbEnabled);
  const guideTimeZone = useSettingsStore((state) => state.guideTimeZone);
  const setGuideTimeZone = useSettingsStore((state) => state.setGuideTimeZone);
  const guideShiftMinutes = useSettingsStore((state) => state.guideShiftMinutes);
  const fontScale = useSettingsStore((state) => state.fontScale);
  const setFontScale = useSettingsStore((state) => state.setFontScale);
  const gridColumns = useSettingsStore((state) => state.gridColumns);
  const setGridColumns = useSettingsStore((state) => state.setGridColumns);
  const highContrast = useSettingsStore((state) => state.highContrast);
  const setHighContrast = useSettingsStore((state) => state.setHighContrast);
  const setGuideShiftMinutes = useSettingsStore((state) => state.setGuideShiftMinutes);

  const [tmdbCount, setTmdbCount] = React.useState(0);

  React.useEffect(() => {
    void countTmdbCache().then(setTmdbCount);
  }, []);

  const updater = useUpdater();
  const updateLabel = !updater.supported
    ? "Güncelleme yalnızca masaüstü uygulamasında çalışır."
    : updater.state.status === "current"
      ? "En güncel sürümü kullanıyorsun."
      : updater.state.status === "downloading"
        ? `İndiriliyor · %${updater.state.percent}`
        : updater.state.status === "error"
          ? `Denetim başarısız: ${updater.state.message}`
          : updater.state.status === "unsupported"
            ? updater.state.reason === "portable"
              ? "Taşınabilir sürüm kendini güncelleyemez."
              : "Geliştirme derlemesinde güncelleme kapalıdır."
            : "";

  const hasBuildTimeToken = hasBuildTimeTmdbToken();
  const openSubtitlesKey = useSettingsStore((state) => state.openSubtitlesKey);
  const setOpenSubtitlesKey = useSettingsStore((state) => state.setOpenSubtitlesKey);
  const hasBuildTimeSubKey = hasBuildTimeOpenSubtitlesKey();

  const [passphrase, setPassphrase] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [storage, setStorage] = React.useState<StorageEstimate | null>(null);
  const [pendingRestore, setPendingRestore] = React.useState<BackupFile | null>(null);
  const [restorePassphrase, setRestorePassphrase] = React.useState("");
  const [confirmErase, setConfirmErase] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    void estimateStorage().then(setStorage);
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      const { file, stats } = await createBackup(
        passphrase.trim() ? { passphrase: passphrase.trim() } : {},
      );

      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `duthris-iptv-yedek-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Yedek oluşturuldu", {
        description:
          `${stats.profiles} profil · ${stats.sources} kaynak · ` +
          `${formatCount(stats.favorites)} favori · ${formatCount(stats.historyEntries)} geçmiş kaydı` +
          (file.encrypted ? " · şifreli" : " · giriş bilgileri HARİÇ"),
      });
    } catch (error) {
      toast.error("Yedek oluşturulamadı", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFilePicked(file: File) {
    try {
      const parsed = parseBackupFile(await file.text());
      setPendingRestore(parsed);
      setRestorePassphrase("");
    } catch (error) {
      toast.error("Yedek okunamadı", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function handleRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      const stats = await restoreBackup(pendingRestore, {
        passphrase: restorePassphrase.trim() || undefined,
      });
      await Promise.all([refreshSources(), refreshProfiles()]);
      setPendingRestore(null);
      toast.success("Yedek geri yüklendi", {
        description: `${stats.profiles} profil · ${stats.sources} kaynak geri geldi. Kanal listesi için kaynakları yenileyin.`,
      });
    } catch (error) {
      toast.error("Geri yükleme başarısız", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Ayarlar</h1>
          <p className="text-muted-foreground text-sm">
            Verileriniz yalnızca bu cihazda saklanır. Hesap olmadığı için yedek dosyası tek güvenlik
            ağınızdır.
          </p>
        </header>

        <SectionCard
          icon={Download}
          title="Yedek oluştur"
          description="Profiller, kaynaklar, favoriler, izleme geçmişi ve ayarlar tek dosyaya aktarılır. Kanal listesi dahil edilmez — kaynaklardan yeniden çekilebilir."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="backup-pass">Yedek parolası</Label>
            <Input
              id="backup-pass"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Boş bırakılırsa giriş bilgileri yedeğe eklenmez"
              icon={<Lock />}
              autoComplete="new-password"
            />
            <FieldHint>
              Parola girerseniz dosya AES-256 ile şifrelenir ve Xtream parolanız da yedeğe dahil
              edilir. Parolasız yedekte giriş bilgileri bilinçli olarak dışarıda bırakılır — düz
              metin bir dosyada durmasınlar diye.
            </FieldHint>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleExport} loading={busy}>
              <Download /> Yedek dosyasını indir
            </Button>
            {passphrase.trim() ? (
              <Badge variant="success">
                <ShieldCheck /> Şifreli
              </Badge>
            ) : (
              <Badge variant="warning">Giriş bilgileri hariç</Badge>
            )}
          </div>
        </SectionCard>

        <SectionCard
          icon={Upload}
          title="Yedekten geri yükle"
          description="Mevcut profiller, kaynaklar, favoriler ve geçmiş yedektekilerle DEĞİŞTİRİLİR."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) void handleFilePicked(picked);
              event.target.value = "";
            }}
          />

          {pendingRestore ? (
            <div className="border-warning/30 bg-warning/[0.06] flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="text-foreground text-sm font-medium">
                    {new Date(pendingRestore.createdAt).toLocaleString("tr-TR")} tarihli yedek
                    {pendingRestore.encrypted ? " (şifreli)" : ""}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Devam ederseniz mevcut profiller, kaynaklar, favoriler ve izleme geçmişi silinip
                    yedektekilerle değiştirilir. Bu işlem geri alınamaz.
                  </p>
                </div>
              </div>

              {pendingRestore.encrypted ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="restore-pass">Yedek parolası</Label>
                  <Input
                    id="restore-pass"
                    type="password"
                    value={restorePassphrase}
                    onChange={(event) => setRestorePassphrase(event.target.value)}
                    icon={<Lock />}
                    autoComplete="off"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" onClick={handleRestore} loading={busy}>
                  Geri yükle ve değiştir
                </Button>
                <Button variant="ghost" onClick={() => setPendingRestore(null)}>
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload /> Yedek dosyası seç
            </Button>
          )}
        </SectionCard>

        <SectionCard
          icon={MonitorPlay}
          title="Oynatma"
          description="Tercih edilen diller, bir içerik o dili sunuyorsa otomatik seçilir."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="audio-lang">Tercih edilen ses dili</Label>
              <Select
                id="audio-lang"
                value={preferredAudioLang ?? ""}
                onChange={(event) => setPreferredAudioLang(event.target.value || null)}
              >
                <option value="">Otomatik (kaynağın varsayılanı)</option>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sub-lang">Tercih edilen altyazı dili</Label>
              <Select
                id="sub-lang"
                value={preferredSubtitleLang ?? ""}
                onChange={(event) => setPreferredSubtitleLang(event.target.value || null)}
              >
                <option value="">Kapalı</option>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <FieldHint>
            Ses dili yalnızca masaüstünde, yerel dönüştürme devredeyken değiştirilebilir — tarayıcı
            bir dosyanın içindeki ikinci ses akışına erişemiyor.
          </FieldHint>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={keepScreenAwake}
              onChange={(event) => setKeepScreenAwake(event.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm font-medium">Ekran kapanmasın</span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                İzlerken sistemin ekranı karartmasını ve kilitlenmesini engeller. Yalnızca oynatma
                sürerken etkindir.
              </span>
            </span>
          </label>
        </SectionCard>

        <SectionCard
          icon={MonitorCog}
          title="Masaüstü davranışı"
          description="Pencere, sistem tepsisi ve günlükler."
        >
          <DesktopShellSettings />
        </SectionCard>

        <SectionCard
          icon={ArrowUpCircle}
          title="Güncelleme"
          description="Yeni sürümler GitHub üzerinden dağıtılır ve uygulama içinden kurulur."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={updater.check} loading={updater.state.status === "checking"}>
              <RefreshCw /> Güncelleme denetle
            </Button>

            {updater.state.status === "available" ? (
              <Button onClick={updater.download}>{updater.state.version} sürümünü indir</Button>
            ) : null}

            {updater.state.status === "ready" ? (
              <Button onClick={updater.install}>Yeniden başlat ve kur</Button>
            ) : null}

            <span className="text-xs text-muted-foreground">{updateLabel}</span>
          </div>

          <FieldHint>
            Kurulum dosyaları imzasız olduğu için Windows her kurulumda bir uyarı gösterir;
            &quot;Ek bilgi&quot; &rarr; &quot;Yine de çalıştır&quot; ile geçilir. Taşınabilir sürüm kendini
            güncelleyemez, yenisini elle indirmek gerekir.
          </FieldHint>
        </SectionCard>

        <SectionCard
          icon={Type}
          title="Görünüm"
          description="Yazı boyutu, poster ızgarası ve kontrast tercihleri."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="font-scale">Yazı boyutu</Label>
              <Select
                id="font-scale"
                value={String(fontScale)}
                onChange={(event) => setFontScale(Number(event.target.value))}
              >
                {FONT_SCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldHint>
                Arayüzün tamamı ölçeklenir — yalnızca yazı değil, aralıklar ve buton yükseklikleri
                de büyür.
              </FieldHint>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="grid-columns">Poster ızgarası</Label>
              <Select
                id="grid-columns"
                value={String(gridColumns)}
                onChange={(event) => setGridColumns(Number(event.target.value))}
              >
                <option value="0">Pencereye göre (önerilen)</option>
                {[3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>
                    {count} sütun
                  </option>
                ))}
              </Select>
              <FieldHint>
                Sabit bir sayı seçsen bile posterler okunamayacak kadar küçülmez; dar pencerede
                sütun sayısı otomatik azalır.
              </FieldHint>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(event) => setHighContrast(event.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm font-medium">Yüksek kontrast</span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                Kenar çizgilerini ve ikincil yazıları belirginleştirir, arka plandaki dekoratif
                ışıkları söndürür. Parlak ortamda okunabilirliği artırır.
              </span>
            </span>
          </label>
        </SectionCard>

        <SectionCard
          icon={Captions}
          title="Altyazı arama"
          description="Film ve dizilerde eksik altyazıları OpenSubtitles üzerinden arayıp indirir."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="os-key">API anahtarı</Label>
            <Input
              id="os-key"
              type="password"
              value={openSubtitlesKey}
              onChange={(event) => setOpenSubtitlesKey(event.target.value)}
              placeholder={
                hasBuildTimeSubKey ? "Uygulamayla gelen anahtar kullanılıyor" : "OpenSubtitles API anahtarı"
              }
              autoComplete="off"
              className="max-w-lg"
            />
            <FieldHint>
              Günlük indirme hakkı anahtar başınadır, kullanıcı başına değil. Kendi anahtarını
              girmek istersen opensubtitles.com üzerinden ücretsiz alabilirsin.
            </FieldHint>
          </div>
        </SectionCard>

        <SectionCard
          icon={CalendarClock}
          title="TV rehberi saati"
          description="Program saatlerinin hangi saat dilimine göre gösterileceğini ve gerekirse kayma düzeltmesini belirler."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="guide-tz">Saat dilimi</Label>
              <Select
                id="guide-tz"
                value={guideTimeZone ?? ""}
                onChange={(event) => setGuideTimeZone(event.target.value || null)}
              >
                <option value="">Cihazın saat dilimi</option>
                {GUIDE_TIME_ZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="guide-shift">Kayma düzeltmesi</Label>
              <Select
                id="guide-shift"
                value={String(guideShiftMinutes)}
                onChange={(event) => setGuideShiftMinutes(Number(event.target.value))}
              >
                {GUIDE_SHIFT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 0 ? "Düzeltme yok" : `${option > 0 ? "+" : ""}${option / 60} saat`}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <FieldHint>
            Saat dilimi yalnızca gösterimi değiştirir. Rehberdeki tüm programlar sabit bir miktar
            kaymış görünüyorsa sebebi saat dilimi değil, kaynağın saat bilgisini eksik
            yayınlamasıdır — o durumda kayma düzeltmesini kullanın.
          </FieldHint>
        </SectionCard>

        <SectionCard
          icon={Sparkles}
          title="TMDB zenginleştirme"
          description="Sağlayıcının vermediği afiş, arka plan, konu ve oyuncu bilgilerini TMDB'den tamamlar."
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={tmdbEnabled}
              onChange={(event) => setTmdbEnabled(event.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm font-medium">Zenginleştirmeyi kullan</span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                Bilgiler yalnızca bir film veya dizi açıldığında çekilir ve cihazda saklanır; aynı
                içerik ikinci kez açıldığında istek gitmez.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tmdb-token">API anahtarı</Label>
            <Input
              id="tmdb-token"
              type="password"
              value={tmdbToken}
              onChange={(event) => setTmdbToken(event.target.value)}
              placeholder={
                hasBuildTimeToken ? "Uygulamayla gelen anahtar kullanılıyor" : "TMDB API anahtarı"
              }
              autoComplete="off"
              className="max-w-lg"
            />
            <FieldHint>
              {hasBuildTimeToken
                ? "Boş bırakırsan uygulamayla gelen anahtar kullanılır. Kendi anahtarını girmek istersen themoviedb.org › Ayarlar › API bölümünden alabilirsin."
                : "themoviedb.org üzerinden ücretsiz bir hesap açıp Ayarlar › API bölümünden alabilirsin. Anahtar girilmeden zenginleştirme çalışmaz."}
            </FieldHint>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                await clearTmdbCache();
                setTmdbCount(0);
                toast.success("TMDB önbelleği temizlendi");
              }}
            >
              <Trash2 /> Önbelleği temizle
            </Button>
            <span className="tabular text-muted-foreground text-xs">
              {formatCount(tmdbCount)} içerik önbellekte
            </span>
          </div>
        </SectionCard>

        <SectionCard
          icon={RefreshCw}
          title="Otomatik yenileme"
          description="Kanal listesi ve TV rehberi arka planda güncellenir. Rehber genelde bir gün içinde bayatlar."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="auto-refresh">Yenileme sıklığı</Label>
            <Select
              id="auto-refresh"
              value={String(autoRefreshHours)}
              onChange={(event) => setAutoRefreshHours(Number(event.target.value))}
              className="max-w-xs"
            >
              {REFRESH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <FieldHint>
              Yenileme yalnızca uygulama açıkken ve son güncellemenin üzerinden yeterli süre
              geçmişse çalışır. İçe aktarma arka planda yapılır, izlemeyi kesmez.
            </FieldHint>
          </div>
        </SectionCard>

        <SectionCard
          icon={HardDrive}
          title="Depolama"
          description="Kanal listesi ve TV rehberi cihazınızda saklanır."
        >
          {storage ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-2xs text-muted-foreground uppercase tracking-wide">
                  Kullanılan
                </dt>
                <dd className="tabular text-md text-foreground font-semibold">
                  {formatBytes(storage.usageBytes)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-2xs text-muted-foreground uppercase tracking-wide">Sınır</dt>
                <dd className="tabular text-md text-foreground font-semibold">
                  {formatBytes(storage.quotaBytes)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-2xs text-muted-foreground uppercase tracking-wide">
                  Kalıcı mı
                </dt>
                <dd className="text-md text-foreground font-semibold">
                  {storage.persisted ? "Evet" : "Hayır"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">Depolama bilgisi alınamadı.</p>
          )}

          {storage && !storage.persisted ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={async () => {
                const granted = await requestPersistentStorage();
                setStorage(await estimateStorage());
                toast[granted ? "success" : "warning"](
                  granted
                    ? "Verileriniz kalıcı olarak işaretlendi"
                    : "Tarayıcı kalıcı depolamayı reddetti",
                );
              }}
            >
              <ShieldCheck /> Verileri kalıcı yap
            </Button>
          ) : null}
        </SectionCard>

        <SectionCard
          icon={Database}
          title="İçerik"
          description="Listelerde nelerin görüneceğini belirler."
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={showAdult}
              onChange={(event) => setShowAdult(event.target.checked)}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm font-medium">
                Yetişkin kategorileri göster
              </span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                Kapalıyken yetişkin olarak işaretlenen kategoriler ve içerikleri listelerde
                görünmez. İşaretleme kaynak içe aktarılırken yapılır, bu yüzden değişiklik sonrası
                kaynağı yenilemek gerekebilir.
              </span>
            </span>
          </label>
        </SectionCard>

        <SectionCard
          icon={Trash2}
          title="Tüm verileri sil"
          description="Profiller, kaynaklar, kanallar, favoriler, geçmiş ve TV rehberi dahil her şey silinir."
          tone="danger"
        >
          {confirmErase ? (
            <div className="border-destructive/30 bg-destructive/[0.07] flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-foreground text-sm leading-relaxed">
                {sources.length > 0
                  ? `${sources.length} kaynak ve tüm kişisel verileriniz silinecek. `
                  : ""}
                Bu işlem geri alınamaz. Önce yedek almanız önerilir.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    await eraseAllData();
                    await Promise.all([refreshSources(), refreshProfiles()]);
                    setBusy(false);
                    setConfirmErase(false);
                    toast.success("Tüm veriler silindi");
                    window.location.href = "/";
                  }}
                >
                  <Trash2 /> Evet, her şeyi sil
                </Button>
                <Button variant="ghost" onClick={() => setConfirmErase(false)}>
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="text-destructive hover:border-destructive/50 self-start"
              onClick={() => setConfirmErase(true)}
            >
              <Trash2 /> Tüm verileri sil
            </Button>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
