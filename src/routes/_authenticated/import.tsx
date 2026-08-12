import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Sparkles, Trash2 } from "lucide-react";
import { useAccounts, useCategories } from "@/lib/data";
import { kr } from "@/lib/format";
import { readStatementFile } from "@/lib/import/read";
import type { Encoding } from "@/lib/import/decode";
import {
  buildRows,
  detectHeaderRow,
  guessColumns,
  normalizeMerchant,
  withHashes,
  DATE_FORMATS,
  type AmountMode,
  type ColumnMap,
  type DateFormat,
} from "@/lib/import/parse";
import { matchRule, suggestPattern, type MerchantRule } from "@/lib/import/rules";
import {
  existingHashes,
  useCommitImport,
  useDeleteImportProfile,
  useImportProfiles,
  useMerchantRules,
  useSaveImportProfile,
  useSaveMerchantRule,
  type ReviewRow,
} from "@/lib/import/data";
import { categorizeDescriptions } from "@/lib/categorize.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Importera kontoutdrag — Skuldfri" },
      {
        name: "description",
        content:
          "Läs in CSV och Excel från banken direkt i webbläsaren, granska raderna och godkänn innan något sparas.",
      },
      { property: "og:title", content: "Importera kontoutdrag — Skuldfri" },
      {
        property: "og:description",
        content: "Filen lämnar aldrig webbläsaren. Kolumntolkning i kod, granskning före sparning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

type Step = "file" | "map" | "review";

const COLUMN_KEYS: { key: keyof ColumnMap; label: string; modes?: AmountMode[] }[] = [
  { key: "date", label: "Transaktionsdatum" },
  { key: "booking_date", label: "Bokföringsdatum" },
  { key: "description", label: "Beskrivning" },
  { key: "amount", label: "Belopp", modes: ["signed"] },
  { key: "in", label: "Insättning", modes: ["two_column"] },
  { key: "out", label: "Uttag", modes: ["two_column"] },
  { key: "balance", label: "Saldo" },
  { key: "reference", label: "Referens/löpnummer" },
];

function ImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: rules = [] } = useMerchantRules();
  const { data: profiles = [] } = useImportProfiles();
  const saveProfile = useSaveImportProfile();
  const deleteProfile = useDeleteImportProfile();
  const saveRule = useSaveMerchantRule();
  const commit = useCommitImport();
  const categorize = useServerFn(categorizeDescriptions);

  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [encoding, setEncoding] = useState<Encoding>("utf-8");
  const [fellBack, setFellBack] = useState(false);
  const [delimiter, setDelimiter] = useState(";");
  const [headerRow, setHeaderRow] = useState(0);
  const [dateFormat, setDateFormat] = useState<DateFormat>("YYYY-MM-DD");
  const [amountMode, setAmountMode] = useState<AmountMode>("signed");
  const [signFlip, setSignFlip] = useState(false);
  const [columnMap, setColumnMap] = useState<ColumnMap>({ date: 0, description: 1, amount: 2 });
  const [accountId, setAccountId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiRan, setAiRan] = useState(false);

  const headers = matrix[headerRow] ?? [];
  const preview = matrix.slice(headerRow + 1, headerRow + 6);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  async function onFile(file: File | undefined, profile?: (typeof profiles)[number]) {
    if (!file) return;
    setBusy(true);
    try {
      const read = await readStatementFile(
        file,
        profile ? { encoding: profile.encoding, delimiter: profile.delimiter } : undefined,
      );
      setFileName(read.fileName);
      setMatrix(read.matrix);
      setEncoding(read.encoding);
      setFellBack(read.fellBack);
      setDelimiter(read.delimiter);

      if (profile) {
        setHeaderRow(profile.header_row);
        setDateFormat(profile.date_format);
        setAmountMode(profile.amount_mode);
        setSignFlip(profile.sign_flip);
        setColumnMap(profile.column_map);
        setAccountId(profile.account_id ?? "");
        setProfileName(profile.name);
        setProfileId(profile.id);
      } else {
        const hr = detectHeaderRow(read.matrix);
        const guess = guessColumns(read.matrix[hr] ?? [], read.matrix.slice(hr + 1, hr + 30));
        setHeaderRow(hr);
        setColumnMap(guess.columnMap);
        setAmountMode(guess.amountMode);
        setDateFormat(guess.dateFormat);
        setSignFlip(false);
        setProfileId(null);
        setProfileName(file.name.replace(/\.[^.]+$/, ""));
      }
      setStep("map");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Filen gick inte att läsa");
    } finally {
      setBusy(false);
    }
  }

  async function toReview() {
    setBusy(true);
    try {
      const built = buildRows(matrix, { columnMap, dateFormat, amountMode, signFlip, headerRow });
      if (built.rows.length === 0) {
        toast.error("Inga rader kunde tolkas — kontrollera kolumnerna.");
        return;
      }
      const hashed = await withHashes(built.rows, accountId || null);
      const existing = await existingHashes(hashed.map((r) => r.import_hash!).filter(Boolean));
      const reviewed: ReviewRow[] = hashed.map((r) => {
        const rule = matchRule(rules as MerchantRule[], r.raw_description);
        return {
          ...r,
          category_id: rule?.category_id ?? null,
          categorySource: rule ? "rule" : null,
          duplicate: r.import_hash ? existing.has(r.import_hash) : false,
          include: true,
        };
      });
      setRows(reviewed);
      setAiRan(false);
      setStep("review");
      if (built.skipped > 0) toast.info(`${built.skipped} rader hoppades över (saknar datum eller belopp).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte tolka raderna");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsProfile() {
    if (!profileName.trim()) {
      toast.error("Ge profilen ett namn");
      return;
    }
    const id = await saveProfile.mutateAsync({
      ...(profileId ? { id: profileId } : {}),
      name: profileName.trim(),
      account_id: accountId || null,
      delimiter,
      encoding,
      header_row: headerRow,
      date_format: dateFormat,
      column_map: columnMap,
      amount_mode: amountMode,
      sign_flip: signFlip,
    });
    setProfileId(id);
    toast.success("Bankprofil sparad — nästa gång läses filen in direkt.");
  }

  async function runAi() {
    const uncategorized = rows.filter((r) => !r.category_id && !r.duplicate && r.include);
    if (uncategorized.length === 0) {
      toast.info("Alla rader har redan en kategori.");
      return;
    }
    const expenseCats = categories.filter((c) => c.kind === "utgift").map((c) => c.name);
    const incomeCats = categories.filter((c) => c.kind === "inkomst").map((c) => c.name);
    const names = [...expenseCats, ...incomeCats];
    if (names.length === 0) {
      toast.error("Lägg upp kategorier först.");
      return;
    }
    // Endast beskrivningssträngar skickas — aldrig belopp, saldon eller konton.
    const unique = [...new Set(uncategorized.map((r) => normalizeMerchant(r.raw_description)))].filter(
      Boolean,
    );
    setBusy(true);
    try {
      const res = await categorize({ data: { descriptions: unique, categories: names } });
      const byDesc = new Map(res.matches.map((m) => [m.description, m.category]));
      const byName = new Map(categories.map((c) => [c.name, c.id]));
      setRows((prev) =>
        prev.map((r) => {
          if (r.category_id) return r;
          const hit = byDesc.get(normalizeMerchant(r.raw_description));
          const id = hit ? byName.get(hit) : undefined;
          return id ? { ...r, category_id: id, categorySource: "ai" } : r;
        }),
      );
      setAiRan(true);
      toast.success("AI-förslag ifyllda — granska innan du sparar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI-förslaget misslyckades");
    } finally {
      setBusy(false);
    }
  }

  async function setCategory(row: ReviewRow, categoryId: string, makeRule: boolean) {
    setRows((prev) =>
      prev.map((r) =>
        r.index === row.index
          ? { ...r, category_id: categoryId || null, categorySource: categoryId ? "manual" : null }
          : r,
      ),
    );
    if (makeRule && categoryId) {
      const pattern = suggestPattern(row.raw_description);
      if (pattern) {
        await saveRule.mutateAsync({ pattern, category_id: categoryId });
        toast.success(`Regel sparad: "${pattern}" → ${catById.get(categoryId)?.name ?? ""}`);
      }
    }
  }

  async function doCommit() {
    const n = await commit.mutateAsync({ rows, accountId: accountId || null });
    toast.success(n === 0 ? "Inga rader att spara" : `${n} transaktioner sparade`);
    setStep("file");
    setRows([]);
    setMatrix([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  const newRows = rows.filter((r) => !r.duplicate);
  const dupes = rows.length - newRows.length;
  const selected = newRows.filter((r) => r.include);
  const uncategorized = selected.filter((r) => !r.category_id).length;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-base font-semibold tracking-tight">Importera kontoutdrag</h1>
        <span className="text-[0.7rem] text-muted-foreground">
          {step === "file" ? "1 av 3 · fil" : step === "map" ? "2 av 3 · kolumner" : "3 av 3 · granska"}
        </span>
      </div>
      <p className="px-1 text-13 text-muted-foreground">
        Filen läses i din webbläsare och laddas aldrig upp. Ingen rad skrivs förrän du godkänner den
        i granskningen.
      </p>

      {step === "file" && (
        <>
          <div className="panel space-y-3 p-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-[6px] border border-dashed border-border px-3 py-6 text-13 text-muted-foreground hover:text-foreground">
              <FileUp className="size-4" />
              {busy ? "Läser filen…" : "Välj CSV eller Excel från banken"}
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>

          {profiles.length > 0 && (
            <section className="panel">
              <h2 className="border-b border-border px-3 py-2 text-13 font-semibold">
                Sparade bankprofiler
              </h2>
              <ul className="divide-y divide-border/60">
                {profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-13">
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="num text-[0.7rem] text-muted-foreground">
                      {p.delimiter === "\t" ? "tab" : p.delimiter} · {p.encoding} · {p.date_format}
                    </span>
                    <label className="cursor-pointer rounded-[6px] border border-border px-2 py-1 text-[0.7rem]">
                      Använd
                      <input
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => onFile(e.target.files?.[0], p)}
                      />
                    </label>
                    <button
                      aria-label="Ta bort profil"
                      className="p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteProfile.mutate(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {step === "map" && (
        <>
          {fellBack && (
            <div className="panel flex items-start gap-2 p-3 text-13">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--signal)]" />
              <span>
                Filen var inte UTF-8 — den lästes om som windows-1252 så att å, ä och ö blev rätt.
              </span>
            </div>
          )}

          <section className="panel space-y-2 p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-13 font-semibold">{fileName}</h2>
              <span className="num text-[0.7rem] text-muted-foreground">
                {matrix.length} rader · {encoding} · avgränsare{" "}
                {delimiter === "\t" ? "tab" : delimiter}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[0.7rem] text-muted-foreground">
                Rubrikrad
                <Input
                  type="number"
                  min={0}
                  className="num mt-1 h-8"
                  value={headerRow}
                  onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value)))}
                />
              </label>
              <label className="text-[0.7rem] text-muted-foreground">
                Datumformat
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-13"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[0.7rem] text-muted-foreground">
                Beloppsformat
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-13"
                  value={amountMode}
                  onChange={(e) => setAmountMode(e.target.value as AmountMode)}
                >
                  <option value="signed">En kolumn med tecken</option>
                  <option value="two_column">Insättning och uttag</option>
                </select>
              </label>
              <label className="text-[0.7rem] text-muted-foreground">
                Konto
                <select
                  className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-13"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Utan konto</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-1.5 text-13 text-muted-foreground">
              <input
                type="checkbox"
                checked={signFlip}
                onChange={(e) => setSignFlip(e.target.checked)}
              />
              Vänd tecknet (utgifter står som positiva tal i filen)
            </label>
          </section>

          <section className="panel">
            <h2 className="border-b border-border px-3 py-2 text-13 font-semibold">Kolumner</h2>
            <div className="divide-y divide-border/60">
              {COLUMN_KEYS.filter((c) => !c.modes || c.modes.includes(amountMode)).map((c) => (
                <div key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-13">
                  <span className="min-w-0 flex-1">{c.label}</span>
                  <select
                    className="h-8 max-w-[60%] rounded-md border border-input bg-transparent px-2 text-13"
                    value={columnMap[c.key] ?? ""}
                    onChange={(e) =>
                      setColumnMap({
                        ...columnMap,
                        [c.key]: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">–</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i}: {h || "(tom)"}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-x-auto">
            <h2 className="border-b border-border px-3 py-2 text-13 font-semibold">Förhandsgranskning</h2>
            <table className="num w-full text-[0.7rem]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {headers.map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-2 py-1 font-normal">
                      {h || i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    {headers.map((_, c) => (
                      <td key={c} className="whitespace-nowrap px-2 py-1">
                        {r[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex flex-wrap items-center gap-2 px-1">
            <Input
              className="h-8 w-40"
              placeholder="Profilnamn"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <Button size="sm" variant="ghost" onClick={saveAsProfile} disabled={saveProfile.isPending}>
              Spara bankprofil
            </Button>
            <Button size="sm" onClick={toReview} disabled={busy} className="ml-auto">
              Granska rader
            </Button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <section className="panel grid grid-cols-4 divide-x divide-border/60 text-center">
            {[
              { label: "Rader", value: rows.length },
              { label: "Nya", value: newRows.length },
              { label: "Dubbletter", value: dupes },
              { label: "Utan kategori", value: uncategorized },
            ].map((s) => (
              <div key={s.label} className="px-2 py-2">
                <div className="num text-base font-semibold">{s.value}</div>
                <div className="text-[0.7rem] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-2 px-1">
            <Button size="sm" variant="ghost" onClick={runAi} disabled={busy || aiRan}>
              <Sparkles className="mr-1 size-3.5" />
              Föreslå kategorier med AI
            </Button>
            <span className="text-[0.7rem] text-muted-foreground">
              Endast beskrivningarna skickas — aldrig belopp eller konto.
            </span>
          </div>

          <div className="panel divide-y divide-border/60">
            {rows.map((r) => (
              <div key={r.index} className="flex flex-wrap items-center gap-2 px-3 py-2 text-13">
                <input
                  type="checkbox"
                  aria-label="Ta med raden"
                  checked={r.include && !r.duplicate}
                  disabled={r.duplicate}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) => (x.index === r.index ? { ...x, include: e.target.checked } : x)),
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{r.description || "Utan beskrivning"}</div>
                  <div className="num text-[0.7rem] text-muted-foreground">
                    {r.occurred_at}
                    {r.booking_date && r.booking_date !== r.occurred_at ? ` · bokf. ${r.booking_date}` : ""}
                    {r.duplicate ? " · finns redan" : ""}
                    {r.categorySource === "rule" ? " · regel" : r.categorySource === "ai" ? " · AI-förslag" : ""}
                  </div>
                </div>
                <select
                  className="h-8 max-w-[45%] rounded-md border border-input bg-transparent px-2 text-13"
                  value={r.category_id ?? ""}
                  onChange={(e) => setCategory(r, e.target.value, false)}
                >
                  <option value="">Kategori…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  className="text-[0.7rem] text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:no-underline disabled:opacity-40"
                  disabled={!r.category_id}
                  onClick={() => setCategory(r, r.category_id ?? "", true)}
                >
                  regel
                </button>
                <span className={`num font-medium ${r.amount < 0 ? "" : "text-primary"}`}>
                  {kr(r.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-1">
            <Button size="sm" variant="ghost" onClick={() => setStep("map")}>
              Tillbaka
            </Button>
            <Button
              size="sm"
              className="ml-auto"
              onClick={doCommit}
              disabled={commit.isPending || selected.length === 0}
            >
              Spara {selected.length} rader
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
