// Only data already intended to outlive a mission is synchronized. Graphics,
// pointer controls and live mission state remain specific to the device.
export function gameSave(records, settings) {
 const safeRecords={};
 for(const key of ['best','completed','played']) {
  const value=records?.[key];
  if(!Number.isSafeInteger(value)||value<0||value>1_000_000_000) throw new Error('INVALID_RECORDS');
  safeRecords[key]=value;
 }
 if(safeRecords.completed>safeRecords.played) throw new Error('INVALID_RECORDS');
 const preferences={};
 for(const key of ['sound','music','voices']) if(typeof settings?.[key]==='boolean') preferences[key]=settings[key];
 for(const key of ['volume','musicVolume']) if(typeof settings?.[key]==='number'&&Number.isFinite(settings[key])) preferences[key]=Math.max(0,Math.min(100,settings[key]));
 return {version:1,records:safeRecords,preferences};
}
