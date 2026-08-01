"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2, UserRound, X } from "lucide-react";
import { PROFILE_COLORS, createProfile, deleteProfile, type ProfileColor } from "@iptv/db";
import { Badge, Button, Card, FieldHint, Input, Label, cn } from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { SourceAccess } from "@/components/profile/source-access";
import { useProfileStore } from "@/stores/profile-store";
import { initialsOf } from "@/lib/format";

export default function ProfilesPage() {
  const { profiles, activeProfileId, setActiveProfile, refresh } = useProfileStore();
  const activeProfile = profiles.find((entry) => entry.id === activeProfileId) ?? null;
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<ProfileColor>("violet");
  const [isKids, setIsKids] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Bir isim girin");
      return;
    }
    if (profiles.some((profile) => profile.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("Bu isimde bir profil zaten var");
      return;
    }

    setBusy(true);
    try {
      const profile = await createProfile({ name: trimmed, color, isKids });
      await refresh();
      setActiveProfile(profile.id);
      setCreating(false);
      setName("");
      setIsKids(false);
      setError(null);
      toast.success(`${profile.name} profili oluşturuldu`);
    } catch {
      setError("Profil oluşturulamadı");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (profiles.length <= 1) {
      toast.error("Son profil silinemez");
      setConfirmDeleteId(null);
      return;
    }
    await deleteProfile(id);
    await refresh();
    setConfirmDeleteId(null);
    toast.success("Profil silindi");
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">Profiller</h1>
            <p className="text-muted-foreground text-sm">
              Her profilin kendi favorileri ve izleme geçmişi olur. Playlistler varsayılan olarak
              ortaktır; istersen profil bazında sınırlayabilirsin.
            </p>
          </div>

          {!creating ? (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Profil ekle
            </Button>
          ) : null}
        </header>

        {creating ? (
          <Card variant="elevated" className="p-6">
            <form onSubmit={handleCreate} className="flex flex-col gap-5" noValidate>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-foreground text-lg font-semibold tracking-tight">
                  Yeni profil
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCreating(false)}
                  aria-label="Kapat"
                >
                  <X />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-name">İsim</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  placeholder="Örn. Salon"
                  maxLength={30}
                  invalid={Boolean(error)}
                  autoFocus
                />
                <FieldHint error={Boolean(error)}>{error}</FieldHint>
              </div>

              <div className="flex flex-col gap-2.5">
                <Label>Renk</Label>
                <div className="flex flex-wrap gap-2">
                  {PROFILE_COLORS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-label={`Renk: ${option}`}
                      aria-pressed={color === option}
                      className={cn(
                        "grid size-9 place-items-center rounded-md text-white",
                        "duration-fast ease-brand transition-transform hover:scale-105",
                        "focus-visible:ring-ring/70 focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        color === option
                          ? "ring-ring ring-offset-background ring-2 ring-offset-2"
                          : "ring-1 ring-inset ring-white/15",
                      )}
                      style={{ backgroundColor: `hsl(var(--accent-${option}))` }}
                    >
                      {color === option ? <Check className="size-4" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <label className="border-border bg-surface-2/50 flex cursor-pointer items-start gap-3 rounded-md border p-3.5">
                <input
                  type="checkbox"
                  checked={isKids}
                  onChange={(event) => setIsKids(event.target.checked)}
                  className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-foreground text-sm font-medium">Çocuk profili</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    Yetişkin kategoriler gizlenir ve ebeveyn kilidi açık gelir.
                  </span>
                </span>
              </label>

              <div className="flex justify-end">
                <Button type="submit" loading={busy}>
                  Profili oluştur
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            return (
              <Card
                key={profile.id}
                variant={active ? "feature" : "default"}
                interactive={!active}
                className="flex items-center gap-4 p-4"
                onClick={active ? undefined : () => setActiveProfile(profile.id)}
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white ring-1 ring-inset ring-white/15"
                  style={{ backgroundColor: `hsl(var(--accent-${profile.color}))` }}
                >
                  {initialsOf(profile.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-foreground truncate text-sm font-medium">{profile.name}</p>
                    {active ? <Badge variant="brand">Aktif</Badge> : null}
                    {profile.isKids ? <Badge variant="outline">Çocuk</Badge> : null}
                  </div>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    {active ? "Şu anda kullanılıyor" : "Geçmek için tıklayın"}
                  </p>
                </div>

                {confirmDeleteId === profile.id ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label="Silmeyi onayla"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(profile.id);
                      }}
                    >
                      <Check />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Vazgeç"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmDeleteId(null);
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                ) : profiles.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${profile.name} profilini sil`}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDeleteId(profile.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </Card>
            );
          })}

          {profiles.length === 0 ? (
            <Card className="text-muted-foreground col-span-full flex items-center gap-3 p-6">
              <UserRound className="size-4" />
              <p className="text-sm">Profiller yükleniyor…</p>
            </Card>
          ) : null}
        </div>

        {/*
          Shown for the active profile only, and as its own card rather than
          inside the grid: the profile cards are click-to-switch, so putting
          checkboxes inside one would fight with that.
        */}
        {activeProfile ? (
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-md font-semibold tracking-tight text-foreground">
                {activeProfile.name} için içerik erişimi
              </h2>
              <p className="text-xs text-muted-foreground">
                Birden fazla playlist ekliyse, bu profilin hangilerini göreceğini seçebilirsin.
              </p>
            </div>
            <SourceAccess profile={activeProfile} />
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
