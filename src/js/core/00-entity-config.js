// Keep the saved mappings intact; exclusions affect this dashboard instance only.
function kineticFilterDisabledEntities(config) {
  if (!config || !Array.isArray(config.disabledEntities) || !config.disabledEntities.length) return config;
  const disabled = new Set(config.disabledEntities);
  function visit(value) {
    if (typeof value === 'string') return disabled.has(value) ? '' : value;
    if (Array.isArray(value)) return value.filter(v => !(typeof v === 'string' && disabled.has(v)) && !(v && typeof v === 'object' && (disabled.has(v.id) || disabled.has(v.entity)))).map(visit);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !disabled.has(key)).map(([key, child]) => [key, key === 'disabledEntities' ? child : visit(child)]));
    return value;
  }
  return visit(config);
}
