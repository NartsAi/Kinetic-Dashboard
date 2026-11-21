// Explicit entity areas override inherited device areas. No naming heuristics.
export function discover({ areas, devices, entities, states }, selected = areas.map(a => a.area_id)) {
  const deviceMap = new Map(devices.map(d => [d.id, d]));
  const registry = new Map(entities.map(e => [e.entity_id, e]));
  const active = states.filter(s => { const e = registry.get(s.entity_id); return !e?.disabled_by && !e?.hidden_by; });
  const areaOf = s => { const e = registry.get(s.entity_id); return e?.area_id || deviceMap.get(e?.device_id)?.area_id; };
  const name = s => s.attributes?.friendly_name || s.entity_id;
  const domain = (list, d) => list.filter(s => s.entity_id.startsWith(d + '.')).map(s => s.entity_id);
  const cls = (list, d, c) => list.filter(s => s.entity_id.startsWith(d + '.') && c.includes(s.attributes?.device_class)).map(s => s.entity_id);
  const house = areas.filter(a => selected.includes(a.area_id)).map(a => {
    const list = active.filter(s => areaOf(s) === a.area_id);
    return { id: a.area_id, name: a.name, icon: (a.icon || 'mdi:home').replace(/^mdi:/, ''),
      lights: domain(list, 'light'), covers: domain(list, 'cover'), fans: domain(list, 'fan'), climate: domain(list, 'climate'),
      temp: cls(list, 'sensor', ['temperature'])[0] || '', hum: cls(list, 'sensor', ['humidity'])[0] || '',
      occ: cls(list, 'binary_sensor', ['occupancy', 'presence', 'motion']), windows: cls(list, 'binary_sensor', ['window']), doors: cls(list, 'binary_sensor', ['door', 'garage_door']),
      sections: [{ name: 'Controls', items: domain(list, 'switch') }] };
  });
  const included = active.filter(s => !areaOf(s) || selected.includes(areaOf(s)));
  const cameras = included.filter(s => s.entity_id.startsWith('camera.')).map(s => ({ id: s.entity_id, name: name(s) }));
  return { house, tiles: house.map(r => ({ room: r.id, name: r.name, icon: r.icon, temp: r.temp, hum: r.hum, climate: r.climate[0] || '' })),
    rooms: included.filter(s => s.entity_id.startsWith('climate.')).map((s, i) => ({ id: s.entity_id, name: name(s), icon: 'thermostat', main: i === 0 })),
    cameras, security: cameras, media: domain(included, 'media_player'), calendars: domain(included, 'calendar'), weather: domain(included, 'weather')[0] || '', alarm: domain(included, 'alarm_control_panel')[0] || '' };
}
