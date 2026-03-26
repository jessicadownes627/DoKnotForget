function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (rawLines.length === 0) return [];

  const headers = parseCsvLine(rawLines[0]).map((header) => header.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < rawLines.length; i += 1) {
    const values = parseCsvLine(rawLines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      if (!key) continue;
      row[key] = values[j] ?? "";
    }
    const hasContent = Object.values(row).some((value) => String(value ?? "").trim().length > 0);
    if (hasContent) rows.push(row);
  }

  return rows;
}

function hasValidUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchRecommendationsFromSheet(sheetUrl) {
  const url = (sheetUrl ?? "").trim();
  if (!url) {
    console.warn("No recommendations sheet URL set");
    return [];
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Failed to load recommendations", new Error(`HTTP ${res.status}`));
      return [];
    }

    const text = await res.text();
    const rows = parseCsv(text).map((row) => ({
        type: String(row.type ?? "").trim(),
        title: String(row.title ?? "").trim(),
        description: String(row.description ?? "").trim(),
        url: String(row.url ?? "").trim(),
        active: String(row.active ?? "").trim(),
      }));

    const recommendations = rows.filter((row) => {
      const is7Day = row.type?.trim().toLowerCase() === "7day";
      const isActive = row.active?.trim().toUpperCase() === "TRUE";
      return is7Day && isActive && hasValidUrl(row.url);
    });

    console.log("Parsed rows:", rows);
    console.log("Filtered recommendations:", recommendations);

    return recommendations;
  } catch (err) {
    console.warn("Failed to load recommendations", err);
    return [];
  }
}
