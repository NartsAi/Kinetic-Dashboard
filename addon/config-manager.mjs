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
  const vehicleGroup = add('details'); vehicleGroup.open = true; add('summary', 'Vehicle configuration', vehicleGroup);
  const enabledLabel = add('label', '', vehicleGroup), enabled = add('input', '', enabledLabel); enabled.type = 'checkbox'; enabled.id = 'vehicle-enabled'; enabled.checked = !!config.vehicle; enabledLabel.append(document.createTextNode(' Enable vehicle'));
  enabled.onchange = () => { if (enabled.checked) pages.get('vehicle').checked = true; };
  const inputField = (title, value, id, parent = vehicleGroup) => { const label = add('label', title, parent), input = add('input', '', label); input.type = 'text'; input.value = value ?? ''; input.id = id; return input; };
  const vehicle = config.vehicle || {};
  const name = inputField('Vehicle name', vehicle.name || 'My vehicle', 'vehicle-name');
  const prefix = inputField('Legacy entity prefix (optional when mapping individual entities)', vehicle.prefix, 'vehicle-prefix');
  const plate = inputField('Registration (optional)', vehicle.plate, 'vehicle-plate');
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
  const button = add('button', 'Apply feature changes to editor'); button.id = 'apply-features';
  button.onclick = () => {
    // Merge into the current editor, not the stale configuration used to draw the form.
    try {
      const next = JSON.parse(document.getElementById('config').value);
      next.pages = [...pages].filter(([, input]) => input.checked).map(([page]) => page);
      if (enabled.checked) {
        next.vehicle = { lowFuelPct: 15, ...next.vehicle, name: name.value.trim(), prefix: prefix.value.trim(), plate: plate.value.trim(), entities: { ...next.vehicle?.entities } };
        for (const [key, input] of bindings) { const id = input.value.trim(); if (id && !/^(sensor|binary_sensor)\.[a-z0-9_]+$/.test(id)) throw Error('Vehicle mappings must be sensor or binary_sensor entity IDs: ' + key); next.vehicle.entities[key] = id; }
      } else next.vehicle = null;
      for (const [key, input] of simple) next[key] = input.value.trim();
      apply(next); renderManager(next, inventory, apply);
    } catch (e) { document.getElementById('status').textContent = e.message; }
  };
}
