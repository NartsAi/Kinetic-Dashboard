const DOMAINS = { climate: 'Climate', light: 'Lights', switch: 'Switches', cover: 'Covers and blinds', fan: 'Fans', camera: 'Cameras', media_player: 'Media players', calendar: 'Calendars', weather: 'Weather', alarm_control_panel: 'Alarms', sensor: 'Sensors', binary_sensor: 'Binary sensors', scene: 'Scenes', script: 'Scripts' };
export function entityReferences(config) {
  const refs = new Set();
  const add = value => { if (typeof value === 'string' && /^[a-z_]+\.[a-z0-9_]+$/.test(value)) refs.add(value); };
  function visit(value) {
    if (typeof value === 'string') return add(value);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { if (key === 'disabledEntities') continue; add(key); visit(child); }
  }
  visit(config); return refs;
}
export function updateEntityEnabled(config, id, enabled, inventory) {
  const disabled = new Set(config.disabledEntities || []);
  if (!enabled) { disabled.add(id); config.disabledEntities = [...disabled]; return config; }
  disabled.delete(id); config.disabledEntities = [...disabled];
  if (entityReferences(config).has(id)) return config;
  const state = inventory.states.find(s => s.entity_id === id), name = state?.attributes?.friendly_name || id;
  const domain = id.split('.')[0];
  const append = (object, key, value, keyOf = v => v) => { object[key] ||= []; if (!object[key].some(v => keyOf(v) === keyOf(value))) object[key].push(value); };
  if (domain === 'climate') append(config, 'rooms', { id, name, icon: 'thermostat', main: !(config.rooms || []).some(r => r.main) }, v => v.id);
  if (domain === 'camera') { for (const key of ['cameras', 'security']) append(config, key, { id, name }, v => v.id); return config; }
  if (domain === 'media_player' || domain === 'calendar') { append(config, domain === 'calendar' ? 'calendars' : 'media', id); return config; }
  if (domain === 'weather' || domain === 'alarm_control_panel') { config[domain === 'weather' ? 'weather' : 'alarm'] = id; return config; }
  const entry = inventory.entities.find(e => e.entity_id === id);
  const area = entry?.area_id || inventory.devices.find(d => d.id === entry?.device_id)?.area_id;
  const roomId = area || 'kinetic_unassigned', roomName = inventory.areas.find(a => a.area_id === area)?.name || 'Other devices';
  config.house ||= [];
  let room = config.house.find(r => r.id === roomId);
  if (!room) { room = { id: roomId, name: roomName, icon: 'home' }; config.house.push(room); }
  append(config, 'tiles', { room: roomId, name: roomName, icon: 'home' }, v => v.room);
  const group = { climate: 'climate', light: 'lights', cover: 'covers', fan: 'fans' }[domain];
  if (group) { if (typeof room[group] === 'string') room[group] = [room[group]]; append(room, group, id); return config; }
  room.sections ||= []; let controls = room.sections.find(s => s.name === 'Enabled entities');
  if (!controls) { controls = { name: 'Enabled entities', items: [] }; room.sections.push(controls); }
  append(controls, 'items', id, v => typeof v === 'string' ? v : v.entity); return config;
}

export function renderEntityGroups(parent, config, inventory, add) {
  const refs = entityReferences(config), excluded = new Set(config.disabledEntities || []);
  const states = new Map(inventory.states.map(s => [s.entity_id, s]));
  const registry = new Map(inventory.entities.map(e => [e.entity_id, e]));
  const candidates = new Set([...states.keys(), ...registry.keys(), ...refs]);
  const outer = add('details', '', parent); add('summary', 'Entities by type — enable or disable in Kinetic', outer);
  add('p', 'These toggles affect Kinetic only, not the Home Assistant integration. Existing mappings are retained when switched off and restored when switched on. New entities are added to the relevant page or their area’s room controls. Weather and alarm are single-entity slots. Camera page selection is available separately above.', outer);
  const choices = new Map();
  for (const [domain, title] of Object.entries(DOMAINS)) {
    const ids = [...candidates].filter(id => id.startsWith(domain + '.')).sort((a, b) => (states.get(a)?.attributes?.friendly_name || a).localeCompare(states.get(b)?.attributes?.friendly_name || b));
    if (!ids.length) continue;
    const group = add('details', '', outer), summary = add('summary', '', group);
    const entries = ids.map(id => { const entry = { id, initial: refs.has(id) && !excluded.has(id), checked: refs.has(id) && !excluded.has(id), locked: !!registry.get(id)?.disabled_by }; choices.set(id, entry); return entry; });
    const count = () => { summary.textContent = title + ' — ' + entries.filter(e => e.checked && !e.locked).length + ' enabled / ' + entries.length; }; count();
    let built = false;
    group.addEventListener('toggle', () => {
      if (!group.open || built) return; built = true;
      const filterLabel = add('label', 'Filter ' + title, group), filter = add('input', '', filterLabel); filter.type = 'search'; filter.placeholder = 'Name or entity ID';
      const list = add('div', '', group); list.style.cssText = 'max-height:280px;overflow:auto;overscroll-behavior:contain;padding:4px';
      const rows = entries.map(entry => {
        const label = add('label', '', list), input = add('input', '', label); input.type = 'checkbox'; input.checked = entry.checked; input.disabled = entry.locked; input.dataset.entityId = entry.id;
        const state = states.get(entry.id), name = state?.attributes?.friendly_name || registry.get(entry.id)?.name || entry.id;
        const description = name + ' — ' + entry.id + (entry.locked ? ' (disabled in Home Assistant)' : state ? ' · ' + state.state : ' (not currently available)');
        label.append(document.createTextNode(' ' + description)); input.onchange = () => { entry.checked = input.checked; count(); };
        return { label, search: description.toLowerCase() };
      });
      filter.oninput = () => rows.forEach(row => { row.label.hidden = !row.search.includes(filter.value.toLowerCase()); });
    });
  }
  return next => { for (const choice of choices.values()) if (!choice.locked && choice.checked !== choice.initial) updateEntityEnabled(next, choice.id, choice.checked, inventory); return next; };
}
