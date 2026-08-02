import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const tableNames = [
  "customers",
  "jobs",
  "quotes",
  "invoices",
  "equipment",
  "maintenance",
  "expenses",
];

const booleanFields = {
  customers: ["active"],
  jobs: ["pro_bono", "pa811_required"],
  quotes: ["pro_bono", "pa811_required"],
  equipment: ["active"],
};

const decimalFields = {
  jobs: ["amount_quoted", "amount_paid", "machine_hours"],
  quotes: ["normal_price", "quoted_price"],
  invoices: ["amount"],
  equipment: ["hour_meter"],
  maintenance: ["hour_meter", "cost", "next_due_hours"],
  expenses: ["amount"],
};

function readTable(databasePath, tableName) {
  const output = execFileSync("sqlite3", ["-json", databasePath, `select * from ${tableName}`], {
    encoding: "utf8",
  }).trim();
  return output ? JSON.parse(output) : [];
}

function normalizeRows(tableName, rows) {
  return rows.map((source) => {
    const row = { ...source };
    for (const field of booleanFields[tableName] ?? []) {
      row[field] = Boolean(row[field]);
    }
    for (const field of decimalFields[tableName] ?? []) {
      if (row[field] !== null && row[field] !== undefined) {
        row[field] = Number(row[field]).toFixed(2);
      }
    }
    if (tableName === "maintenance") {
      row.updated_at = row.created_at;
    }
    return row;
  });
}

function inspectDatabase(databasePath) {
  const integrity = execFileSync("sqlite3", [databasePath, "pragma integrity_check"], {
    encoding: "utf8",
  }).trim();
  const foreignKeyErrors = execFileSync("sqlite3", ["-json", databasePath, "pragma foreign_key_check"], {
    encoding: "utf8",
  }).trim();

  if (integrity !== "ok" || (foreignKeyErrors && foreignKeyErrors !== "[]")) {
    throw new Error("Legacy SQLite integrity checks failed.");
  }

  return Object.fromEntries(
    tableNames.map((tableName) => [
      tableName,
      normalizeRows(tableName, readTable(databasePath, tableName)),
    ]),
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const pathArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const databasePath = resolve(
    pathArgument ?? "../demi-business-platform/data/demi_business.db",
  );
  const fingerprint = createHash("sha256").update(readFileSync(databasePath)).digest("hex");
  const payload = inspectDatabase(databasePath);
  const counts = Object.fromEntries(tableNames.map((name) => [name, payload[name].length]));

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    source: basename(databasePath),
    sha256: fingerprint,
    counts,
  }, null, 2));

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply after the owner workspace exists.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("active", true);

  if (businessError || businesses?.length !== 1) {
    throw new Error("Migration requires exactly one active target business.");
  }

  const { data, error } = await supabase.rpc("import_legacy_snapshot", {
    target_business_id: businesses[0].id,
    import_source_name: basename(databasePath),
    import_source_sha256: fingerprint,
    import_payload: payload,
  });

  if (error) {
    throw new Error(`Transactional import failed: ${error.message}`);
  }

  const verifiedCounts = {};
  for (const tableName of tableNames) {
    const { count, error: countError } = await supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .eq("business_id", businesses[0].id)
      .not("legacy_id", "is", null);
    if (countError) {
      throw new Error(`Could not verify ${tableName}: ${countError.message}`);
    }
    verifiedCounts[tableName] = count;
  }

  for (const tableName of tableNames) {
    if (verifiedCounts[tableName] !== counts[tableName]) {
      throw new Error(`Verification count mismatch for ${tableName}.`);
    }
  }

  console.log(JSON.stringify({ result: data, verifiedCounts }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
