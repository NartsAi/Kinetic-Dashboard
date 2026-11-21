import { renderEntityGroups } from './entity-groups.mjs';
export const VEHICLE_FIELDS = ['fuel_level', 'range_liquid', 'odometer', 'lock', 'ignition_state', 'park_brake_status', 'distance_start', 'average_speed_start', 'liquid_consumption_start', 'distance_reset', 'average_speed_reset', 'liquid_consumption_reset', 'eco_score_bonus_range', 'eco_score_acceleration', 'eco_score_constant', 'eco_score_free_wheel', 'window_status_front_left', 'window_status_front_right', 'window_status_rear_left', 'window_status_rear_right', 'sunroof_status', 'deck_lid', 'deck_lid_lock', 'starter_battery_state', 'low_brake_fluid_warning', 'low_coolant_level_warning', 'engine_light_warning', 'low_wash_water_warning'];
export const PAGES = ['home', 'rooms', 'climate', 'security', 'weather', 'energy', 'irrigation', 'scenes', 'media', 'events', 'vehicle', 'hazards', 'theme'];
export function diagnostics(config, inventory) {
  const states = new Map(inventory.states.map(s => [s.entity_id, s]));
  const issues = [];
  if (!config.vehicle) issues.push('Vehicle has no configuration. Enable it and select its entities below.');
  else if (!config.vehicle.prefix && !Object.values(config.vehicle.entities || {}).some(Boolean)) issues.push('Vehicle is enabled but has no entity mappings or legacy prefix.');
  if (Array.isArray(config.pages) && !config.pages.includes('vehicle')) issues.push('Vehicle is hidden by the enabled pages setting.');
  const seen = new Set();
  function walk(value) {
    if (typeof value === 'string' && /^(sensor|binary_sensor|light|switch|cover|fan|climate|camera|media_player|weather|calendar|alarm_control_panel|device_tracker|input_boolean|input_text|script|timer)\.[a-z0-9_]+$/.test(value)) {
      if (seen.has(value)) return; seen.add(value);
      const state = states.get(value);
      if (!state) issues.push(value + ': not found in current states (removed, renamed, disabled or inaccessible).');
      else if (['unknown', 'unavailable'].includes(state.state)) issues.push(value + ': ' + state.state);
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  }
  walk(config);
  if (config.vehicle?.prefix && !inventory.states.some(s => s.entity_id.startsWith('sensor.' + config.vehicle.prefix + '_'))) issues.push('No sensor entities match the legacy vehicle prefix: ' + config.vehicle.prefix);
  return issues;
}

export function renderManager(config, inventory, apply) {
  let section = document.getElementById('manager');
  if (!section) { section = document.createElement('section'); section.id = 'manager'; document.getElementById('review').before(section); }
  section.replaceChildren();
  const add = (tag, text, parent = section) => { const el = document.createElement(tag); if (text) el.textContent = text; parent.append(el); return el; };
  add('h2', 'Manage features and missing entities');
  add('p', 'Changes here are applied to the JSON editor first. Review and save to make them active. Refresh discovery after adding integrations or renaming entities.');
  const issues = diagnostics(config, inventory);
  const list = add('ul'); for (const issue of issues) add('li', issue, list);
  if (!issues.length) add('p', 'No missing entity references detected.');
  const pageGroup = add('details'); add('summary', 'Visible dashboard pages', pageGroup);
  const pages = new Map();
  for (const page of PAGES) {
    const label = add('label', '', pageGroup), input = add('input', '', label); input.type = 'checkbox'; input.checked = !Array.isArray(config.pages) || config.pages.includes(page); input.dataset.page = page;
    label.append(document.createTextNode(' ' + page)); pages.set(page, input);
  }
  const cameraGroup = add('details'); add('summary', 'Cameras shown on Home and Security', cameraGroup);
  add('p', 'Discovery can include tablet cameras, recording entities and alternate streams. Choose the feeds you want on each page. The Home gallery scrolls independently when there are many feeds.', cameraGroup);
  const cameraStates = new Map(inventory.states.filter(s => s.entity_id.startsWith('camera.')).map(s => [s.entity_id, s]));
  const cameraIds = [...new Set([...(config.cameras || []).map(c => c.id), ...(config.security || []).map(c => c.id), ...cameraStates.keys()])];
  const cameraChoices = new Map();
  for (const id of cameraIds) {
    const row = add('div', '', cameraGroup); row.style.marginBottom = '12px';
    add('b', cameraStates.get(id)?.attributes?.friendly_name || id, row); add('small', ' ' + id, row);
    const choices = {};
    for (const [key, title] of [['cameras', 'Home'], ['security', 'Security']]) {
      const label = add('label', '', row), input = add('input', '', label); input.type = 'checkbox';
      input.checked = (config[key] || []).some(c => c.id === id); input.dataset.cameraPage = key; input.dataset.cameraId = id;
      label.append(document.createTextNode(' ' + title)); choices[key] = input;
    }
    cameraChoices.set(id, choices);
  }
  if (!cameraIds.length) add('p', 'No camera entities were discovered. Refresh discovery after adding cameras.', cameraGroup);
  const vehicleGroup = add('details'); vehicleGroup.open = true; add('summary', 'Vehicle configuration', vehicleGroup);
  const enabledLabel = add('label', '', vehicleGroup), enabled = add('input', '', enabledLabel); enabled.type = 'checkbox'; enabled.id = 'vehicle-enabled'; enabled.checked = !!config.vehicle; enabledLabel.append(document.createTextNode(' Enable vehicle'));
  enabled.onchange = () => { if (enabled.checked) pages.get('vehicle').checked = true; };
  const inputField = (title, value, id, parent = vehicleGroup) => { const label = add('label', title, parent), input = add('input', '', label); input.type = 'text'; input.value = value ?? ''; input.id = id; return input; };
  const vehicle = config.vehicle || {};
  const name = inputField('Vehicle name', vehicle.name || 'My vehicle', 'vehicle-name');
  const prefix = inputField('Legacy entity prefix (optional when mapping individual entities)', vehicle.prefix, 'vehicle-prefix');
  const plate = inputField('Registration (optional)', vehicle.plate, 'vehicle-plate');
  const artLabel = add('label', 'Vehicle illustration', vehicleGroup), appearance = add('select', '', artLabel); appearance.id = 'vehicle-appearance';
  for (const [value, title] of [['generic', 'Original estate — editable paint'], ['ranger-xlt', 'Ford Ranger XLT double cab — editable paint'], ['ranger-xlt-artwork', 'White Ranger XLT artwork']]) { const option = add('option', title, appearance); option.value = value; }
  appearance.value = vehicle.appearance || 'generic';
  const photo = inputField('Custom vehicle image URL (optional, overrides illustration)', vehicle.photo, 'vehicle-photo');
  const paintLabel = add('label', 'Paint colour', vehicleGroup), paint = add('input', '', paintLabel); paint.type = 'color'; paint.id = 'vehicle-color'; paint.value = /^#[0-9a-f]{6}$/i.test(vehicle.color || '') ? vehicle.color : '#e7e9ed'; paint.style.cssText = 'display:block;width:90px;height:44px';
  const preview = add('div', '', vehicleGroup); preview.id = 'vehicle-preview'; preview.style.cssText = 'max-width:480px;padding:12px;border-radius:14px;background:#171c2b';
  const paintNote = add('p', '', vehicleGroup);
  const drawPreview = () => {
    paint.disabled = !!photo.value.trim() || appearance.value === 'ranger-xlt-artwork';
    paintNote.textContent = paint.disabled ? 'Photo/artwork keeps its original colours. Choose an editable illustration to change paint.' : 'Paint updates the illustration only; your HA entities and sensor values stay unchanged.';
    preview.replaceChildren();
    if (photo.value.trim() || appearance.value === 'ranger-xlt-artwork') { const img = add('img', '', preview); img.alt = 'Vehicle preview'; img.src = photo.value.trim() || 'ranger-xlt.png'; img.style.width = '100%'; }
    else if (appearance.value === 'ranger-xlt' && window.vehicleRangerSvg) preview.innerHTML = window.vehicleRangerSvg(paint.value);
    else preview.innerHTML = '<svg viewBox="0 0 400 160" role="img" aria-label="Estate paint preview"><path d="M20 104 54 53H265L330 91 380 106V132H20Z" fill="' + paint.value + '"/><path d="M65 63H167V89H49ZM180 63H258L300 89H180Z" fill="#253441"/><circle cx="90" cy="130" r="24" fill="#171b22"/><circle cx="310" cy="130" r="24" fill="#171b22"/></svg>';
  };
  appearance.onchange = () => { if (appearance.value.startsWith('ranger-xlt') && ['', 'My vehicle', 'Vehicle'].includes(name.value)) name.value = 'Ford Ranger XLT'; drawPreview(); };
  paint.oninput = photo.oninput = drawPreview; drawPreview();
  add('p', 'Ranger illustrations are stylised double-cabs, not exact model-year drawings.', vehicleGroup);
  add('p', 'Select exact entities from any integration. Fuel must be a percentage, range/odometer kilometres and consumption L/100km. Numeric status codes follow your existing vehicle text maps; different integrations may need HA template sensors. Unmapped fields remain blank.', vehicleGroup);
  const datalist = add('datalist'); datalist.id = 'entity-options';
  for (const state of inventory.states) { const option = add('option', '', datalist); option.value = state.entity_id; option.label = (state.attributes?.friendly_name || state.entity_id) + ' — ' + state.state; }
  const bindings = new Map(); let extra;
  for (const [index, key] of VEHICLE_FIELDS.entries()) {
    if (index === 6) { extra = add('details', '', vehicleGroup); add('summary', 'Optional trips, windows, eco and health sensors', extra); }
    const input = inputField(key.replaceAll('_', ' '), vehicle.entities?.[key], 'vehicle-' + key, index < 6 ? vehicleGroup : extra); input.setAttribute('list', datalist.id); bindings.set(key, input);
  }
  const slots = add('details'); add('summary', 'Common missing features', slots);
  const simple = new Map();
  for (const [key, label] of [['weather', 'Weather entity'], ['alarm', 'Alarm panel entity'], ['outside', 'Outside temperature entity'], ['indoor', 'Indoor temperature entity']]) {
    const row = add('label', label, slots), input = add('input', '', row); input.type = 'text'; input.value = config[key] || ''; input.setAttribute('list', datalist.id); simple.set(key, input);
  }
  const applyEntityGroups = renderEntityGroups(section, config, inventory, add);
  const button = add('button', 'Apply feature changes to editor'); button.id = 'apply-features';
  button.onclick = () => {
    // Merge into the current editor, not the stale configuration used to draw the form.
    try {
      const next = JSON.parse(document.getElementById('config').value);
      next.pages = [...pages].filter(([, input]) => input.checked).map(([page]) => page);
      for (const key of ['cameras', 'security']) next[key] = [...cameraChoices].filter(([, choices]) => choices[key].checked).map(([id]) => (next[key] || []).find(c => c.id === id) || { id, name: cameraStates.get(id)?.attributes?.friendly_name || id });
      if (enabled.checked) {
        next.vehicle = { lowFuelPct: 15, ...next.vehicle, name: name.value.trim(), prefix: prefix.value.trim(), plate: plate.value.trim(), appearance: appearance.value, color: paint.value, photo: photo.value.trim(), entities: { ...next.vehicle?.entities } };
        for (const [key, input] of bindings) { const id = input.value.trim(); if (id && !/^(sensor|binary_sensor)\.[a-z0-9_]+$/.test(id)) throw Error('Vehicle mappings must be sensor or binary_sensor entity IDs: ' + key); next.vehicle.entities[key] = id; }
      } else next.vehicle = null;
      for (const [key, input] of simple) next[key] = input.value.trim();
      applyEntityGroups(next);
      apply(next); renderManager(next, inventory, apply);
    } catch (e) { document.getElementById('status').textContent = e.message; }
  };
}
