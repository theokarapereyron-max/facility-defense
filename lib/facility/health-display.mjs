export const HEALTH_MODES = ['2d','aerial','fps'];
export const HEALTH_TARGETS = ['ally','enemy','player'];

export function healthBarEnabled(settings, mode, target) {
 return settings.healthBars?.[mode]?.[target] ?? true;
}

export function healthBarSettings(value) {
 return Object.fromEntries(HEALTH_MODES.map(mode => [mode,
  Object.fromEntries(HEALTH_TARGETS.map(target => [target,value?.[mode]?.[target] !== false]))
 ]));
}
