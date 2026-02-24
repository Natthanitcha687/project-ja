// Simple i18n loader for a small app (ESM / Vite)
// Usage example in a React component:
// const [strings, setStrings] = useState({});
// useEffect(() => { loadLocale('th').then(setStrings) }, []);
// then use: t('welcome.shop', strings) or fallback to key

export async function loadLocale(locale) {
  try {
    const mod = await import(`../i18n/${locale}.json`);
    return mod.default || mod;
  } catch (err) {
    console.warn('Locale not found:', locale, err);
    // fallback to English
    const mod = await import(`../i18n/en.json`);
    return mod.default || mod;
  }
}

export function t(path, localeData) {
  if (!localeData) return path;
  const parts = path.split('.');
  let cur = localeData;
  for (const p of parts) {
    if (cur[p] === undefined) return path;
    cur = cur[p];
  }
  return cur;
}

// Example helper for React hook
export function useLocale(initial = 'en') {
  let locale = initial;
  let data = {};
  return {
    setLocale: async (l) => {
      locale = l;
      data = await loadLocale(l);
      return data;
    },
    get: (path) => t(path, data)
  };
}
