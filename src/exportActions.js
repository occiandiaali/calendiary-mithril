import { getAllEntries, saveEntry, normalizeDateKey } from "./db";

export async function exportAsJSON() {
  const entries = await getAllEntries();
  if (entries.length) {
    console.log(JSON.stringify(entries));
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "diary-entries.json";
    a.click();

    URL.revokeObjectURL(url);
  } else {
    // console.log("No entries");
    alert(`Looks like there's nothing to export!`);
  }
}

export async function exportAsCSV() {
  const entries = await getAllEntries();
  if (entries.length) {
    const header = "date,text,color\n";
    const rows = entries.map(
      (e) =>
        `"${e.date}","${(e.text || "").replace(/"/g, '""')}","${e.color || ""}"`,
    );
    const csv = header + rows.join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "diary-entries.csv";
    a.click();

    URL.revokeObjectURL(url);
  } else {
    // console.log("No entries");
    alert(`Looks like there's nothing to export!`);
  }
}

export async function emailExport() {
  const entries = await getAllEntries();
  if (entries.length) {
    const jsonData = JSON.stringify(entries, null, 2);

    const subject = encodeURIComponent("My Diary Export");
    const body = encodeURIComponent(jsonData);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  } else {
    // console.log("No entries");
    alert(`Couldn't find any entry to email!`);
  }
}

// Import action from uploaded JSON file
export async function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        if (!Array.isArray(imported)) {
          reject(
            new Error("Invalid file format: expected an array of entries"),
          );
          return;
        }

        for (const entry of imported) {
          try {
            const dateKey = normalizeDateKey(entry.date);
            entry.date = dateKey;

            const existing = await getEntry(dateKey);

            if (existing) {
              // Prompt user with 3 choices
              const choice = prompt(
                `Conflict for ${dateKey}:\n\n` +
                  `Existing: "${existing.text}"\n` +
                  `Imported: "${entry.text}"\n\n` +
                  `Type one of the following:\n` +
                  `- "overwrite" to replace existing\n` +
                  `- "keep" to keep existing\n` +
                  `- "merge" to combine both`,
              );

              if (choice === "overwrite") {
                await saveEntry(entry);
                state.entries[dateKey] = entry.text;
                entryColors[dateKey] =
                  entry.color || entryColors[dateKey] || getRandomColor();
              } else if (choice === "merge") {
                const merged = {
                  ...existing,
                  text: `${existing.text}\n\n${entry.text}`,
                  color: existing.color || entry.color || getRandomColor(),
                };
                await saveEntry(merged);
                state.entries[dateKey] = merged.text;
                entryColors[dateKey] = merged.color;
              } else {
                // "keep" or anything else → do nothing
              }
            } else {
              // No existing entry — just save
              await saveEntry(entry);
              state.entries[dateKey] = entry.text;
              entryColors[dateKey] = entry.color || getRandomColor();
            }
          } catch (err) {
            console.warn("Skipping invalid entry:", entry, err);
          }
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
