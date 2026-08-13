import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "skuldfri:pwa-install-dismissed";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function recentlyDismissed() {
  if (typeof window === "undefined") return true;
  const value = Number(window.localStorage.getItem(DISMISSED_KEY) ?? 0);
  return Number.isFinite(value) && Date.now() - value < SEVEN_DAYS;
}

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    document.documentElement.lang = "sv";

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.webmanifest";
      document.head.appendChild(manifest);
    }

    const meta = (name: string, content: string) => {
      let node = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!node) {
        node = document.createElement("meta");
        node.name = name;
        document.head.appendChild(node);
      }
      node.content = content;
    };
    meta("theme-color", "#FFFFFF");
    meta("apple-mobile-web-app-capable", "yes");
    meta("apple-mobile-web-app-status-bar-style", "default");
    meta("apple-mobile-web-app-title", "Skuldfri");

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      icon.href = "/favicon.ico";
      document.head.appendChild(icon);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone || recentlyDismissed()) return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIos(ios);
    if (ios) setVisible(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setPromptEvent(null);
  }

  if (!visible) return null;

  return (
    <aside className="mb-4 rounded-[8px] border border-border bg-card p-3 shadow-sm" aria-label="Installera Skuldfri">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-[6px] bg-accent p-2">
          {isIos ? <Share className="size-4" /> : <Download className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-13 font-semibold">Ha Skuldfri som en riktig app</div>
          <p className="mt-1 text-12 text-muted-foreground">
            {isIos
              ? "På iPhone: tryck Dela i Safari och välj ‘Lägg till på hemskärmen’. Då öppnas Skuldfri i eget appfönster."
              : "Installera på hemskärmen för snabbare dagliga check-ins och ett eget appfönster."}
          </p>
          {!isIos && promptEvent && (
            <button
              type="button"
              onClick={install}
              className="mt-2 rounded-[6px] bg-signal px-3 py-2 text-12 font-medium text-primary-foreground"
            >
              Installera Skuldfri
            </button>
          )}
        </div>
        <button type="button" onClick={dismiss} className="p-1 text-muted-foreground" aria-label="Dölj">
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
