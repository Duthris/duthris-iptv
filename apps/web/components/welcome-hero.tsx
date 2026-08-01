"use client";

import * as React from "react";
import { HardDrive, MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";
import { updateProfile } from "@iptv/db";
import { Card, FieldHint, Input, Label, cn } from "@iptv/ui";

import { BrandMark } from "@/components/brand-mark";
import { AddPlaylistForm } from "@/components/playlist/add-playlist-form";
import { useActiveProfile, useProfileStore } from "@/stores/profile-store";

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Hesap yok, kayıt yok",
    description: "Playlist'inizi ekleyin ve izlemeye başlayın. E-posta, parola, abonelik yok.",
  },
  {
    icon: HardDrive,
    title: "Verileriniz cihazınızda",
    description:
      "Kanallar, favoriler ve izleme geçmişi yalnızca bu cihazda saklanır. Sunucumuza hiçbir şey gitmez.",
  },
  {
    icon: MonitorSmartphone,
    title: "Telefonda ve bilgisayarda",
    description:
      "Safari'den ana ekrana ekleyerek uygulama gibi kullanın; Windows sürümü daha geniş format desteği sunar.",
  },
];

function ProfileNameField() {
  const profile = useActiveProfile();
  const refreshProfiles = useProfileStore((state) => state.refresh);

  const [name, setName] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (profile && !touched) setName(profile.name);
  }, [profile, touched]);

  React.useEffect(() => {
    if (!touched || !profile) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) return;

    const timer = setTimeout(() => {
      void updateProfile(profile.id, { name: trimmed }).then(() => refreshProfiles());
    }, 600);

    return () => clearTimeout(timer);
  }, [name, touched, profile, refreshProfiles]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="profile-name">Sana nasıl hitap edelim?</Label>
      <Input
        id="profile-name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setTouched(true);
        }}
        placeholder="Örn. Ben"
        maxLength={30}
        icon={<UserRound />}
        autoComplete="off"
      />
      <FieldHint>İlk profilinin adı — sonradan Profiller ekranından değiştirebilirsin.</FieldHint>
    </div>
  );
}

export function WelcomeHero({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-5xl flex-col gap-6", className)}>
      <header className="flex flex-col items-start gap-3.5">
        <BrandMark />

        <div className="flex flex-col gap-2">
          <h1 className="text-foreground max-w-2xl text-2xl font-semibold leading-[1.15] tracking-tight lg:text-3xl">
            Kendi playlist&apos;inizi ekleyin,{" "}
            <span className="text-gradient-brand">izlemeye başlayın.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Duthris IPTV bir oynatıcıdır — içerik sağlamaz. M3U bağlantınızı, M3U dosyanızı veya
            Xtream giriş bilgilerinizi ekleyin, gerisini o halletsin.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
        <Card variant="elevated" className="order-2 flex flex-col gap-5 p-5 lg:order-1 lg:p-6">
          <ProfileNameField />
          <div className="bg-border/70 h-px" />
          <AddPlaylistForm variant="onboarding" />
        </Card>

        <ul className="order-1 flex flex-col gap-4 lg:order-2 lg:pt-1">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex gap-3">
                <span className="bg-brand-500/12 text-primary ring-brand-500/20 mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ring-1 ring-inset">
                  <Icon className="size-3.5" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-foreground text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
