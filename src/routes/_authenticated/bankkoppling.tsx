import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Landmark, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/bankkoppling")({
  head: () => ({
    meta: [
      { title: "Bankkoppling — Skuldfri" },
      {
        name: "description",
        content: "Read-only pilot för bankkoppling. Samtycke, status och synktid visas utan stöd för betalningar.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BankConnectionPage,
});

const statusLabel: Record<string, string> = {
  pending: "Väntar",
  active: "Aktiv",
  expired: "Samtycke utgånget",
  revoked: "Frånkopplad",
  error: "Behöver åtgärdas",
};

function safeConnectUrl(): string | null {
  const value = import.meta.env["VITE_OPEN_BANKING_CONNECT_URL"]?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function BankConnectionPage() {
  const connectUrl = useMemo(() => safeConnectUrl(), []);
  const connections = useQuery({
    queryKey: ["bank-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_connections")
        .select("id,provider,institution_name,status,consent_expires_at,last_synced_at,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const active = connections.data?.filter((item) => item.status === "active") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Read-only pilot
          </p>
          <h1 className="mt-1 text-base font-semibold tracking-tight">Bankkoppling</h1>
          <p className="mt-1 max-w-2xl text-13 text-muted-foreground">
            Målet är att hämta saldo och transaktioner automatiskt till Skuldfri utan betalningsrätt.
            Inga banklösenord eller provider-nycklar ska sparas i webbläsaren eller i appens vanliga tabeller.
          </p>
        </div>
        <div className="rounded-[8px] border border-border bg-card px-3 py-2 text-right">
          <div className="num text-lg font-semibold">{active.length}</div>
          <div className="text-[0.7rem] text-muted-foreground">aktiva banker</div>
        </div>
      </div>

      <section className="panel p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-13 font-semibold">Säkerhetsmodell</h2>
            <p className="text-13 text-muted-foreground">
              Endast läsning. Ingen betalningsinitiering. Skuldfri lagrar bara anslutningens status och
              samtyckesdatum här; provider-hemligheter och banktokens ska ligga server-side hos den
              kommersiella open-banking-integrationen.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-13 font-semibold">Anslutningar</h2>
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
              Status kommer från backend efter bankens samtyckesflöde.
            </p>
          </div>
          <Button
            size="sm"
            disabled={!connectUrl}
            onClick={() => {
              if (connectUrl) window.location.assign(connectUrl);
            }}
          >
            <Landmark className="mr-2 size-4" />
            Koppla bank
          </Button>
        </div>

        {!connectUrl && (
          <div className="flex items-start gap-2 border-b border-border bg-muted/30 px-4 py-3 text-13">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Pilotens anslutningsendpoint är inte aktiverad ännu. Knappen öppnas först när ett
              kommersiellt provideravtal och en appägd HTTPS-endpoint har konfigurerats.
            </p>
          </div>
        )}

        {connections.isLoading ? (
          <div className="flex items-center gap-2 px-4 py-5 text-13 text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" /> Läser anslutningar…
          </div>
        ) : connections.isError ? (
          <div className="flex items-start gap-2 px-4 py-5 text-13">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--signal)]" />
            <div>
              <p className="font-medium">Bankkopplingsregistret är inte tillgängligt.</p>
              <p className="mt-1 text-muted-foreground">
                Databasmigreringen måste vara körd innan pilotvyn kan läsa status.
              </p>
            </div>
          </div>
        ) : connections.data?.length ? (
          <ul className="divide-y divide-border/60">
            {connections.data.map((connection) => (
              <li key={connection.id} className="grid gap-2 px-4 py-3 text-13 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {connection.status === "active" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">
                      {connection.institution_name || "Bankanslutning"}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {statusLabel[connection.status] ?? connection.status}
                    {connection.consent_expires_at
                      ? ` · samtycke till ${new Date(connection.consent_expires_at).toLocaleDateString("sv-SE")}`
                      : ""}
                  </p>
                </div>
                <div className="text-[0.7rem] text-muted-foreground sm:text-right">
                  {connection.last_synced_at
                    ? `Senast synkad ${new Date(connection.last_synced_at).toLocaleString("sv-SE")}`
                    : "Inte synkad ännu"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-6 text-13 text-muted-foreground">
            Ingen bank är kopplad ännu.
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: LockKeyhole,
            title: "Ingen betalningsrätt",
            text: "Piloten är avsedd för konton, saldon och transaktioner – inte för att flytta pengar.",
          },
          {
            icon: RefreshCw,
            title: "Samtycke går ut",
            text: "PSD2-samtycken behöver förnyas. Utgångsdatum visas per anslutning när backend är live.",
          },
          {
            icon: Landmark,
            title: "Import finns kvar",
            text: "CSV/Excel-importen är fortsatt reservvägen och fungerar utan open-banking-provider.",
          },
        ].map((item) => (
          <article key={item.title} className="panel p-4">
            <item.icon className="size-4" />
            <h3 className="mt-3 text-13 font-semibold">{item.title}</h3>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">{item.text}</p>
          </article>
        ))}
      </section>

      <div className="flex flex-wrap gap-2 px-1">
        <Button asChild variant="outline" size="sm">
          <Link to="/import">Importera kontoutdrag nu</Link>
        </Button>
        <p className="self-center text-[0.7rem] text-muted-foreground">
          Bankkopplingen aktiveras inte för andra användare förrän leverantörens kommersiella villkor är klara.
        </p>
      </div>
    </div>
  );
}
