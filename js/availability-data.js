function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const AvailabilityData = {
  formatKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  parseCsv(text) {
    const lines = text.trim().split("\n");
    const map = {};
    for (let i = 1; i < lines.length; i++) {
      const parts = splitCsvLine(lines[i]);
      const rawDate = (parts[0] || "").trim();
      const status = (parts[1] || "").trim().toLowerCase();
      const note = (parts[2] || "").trim();
      if (!rawDate) continue;
      const parsed = new Date(rawDate);
      if (isNaN(parsed)) continue;
      map[this.formatKey(parsed)] = { status, note };
    }
    return map;
  },

  fetch(url) {
    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load availability");
        return res.text();
      })
      .then((text) => this.parseCsv(text));
  }
};

if (typeof window !== "undefined") {
  window.AvailabilityData = AvailabilityData;
}