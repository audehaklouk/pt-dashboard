const BASE = '';

export async function fetchFilters() {
  const res = await fetch(`${BASE}/api/filters`);
  if (!res.ok) throw new Error('Failed to fetch filters');
  return res.json();
}

export async function fetchThreads(params: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const res = await fetch(`${BASE}/api/threads?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
}

export async function importCSV(file: File, workspace: string, brand: string, country: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('workspace', workspace);
  form.append('brand', brand);
  form.append('country', country);
  const res = await fetch(`${BASE}/api/import`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Import failed');
  }
  return res.json();
}
