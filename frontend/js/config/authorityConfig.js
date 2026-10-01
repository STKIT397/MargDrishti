/**
 * MargDrishti — Centralized Road Type & Responsible Authority Configuration
 * Maps road classifications to the official jurisdiction authority.
 * Shared across Citizen reporting, Authority registration, and Triage queues.
 */

export const ROAD_LOCATION_TYPES = [
  'City / Municipal Road',
  'State Highway',
  'National Highway',
  'Rural / Village Road',
  'Private / Society Road'
];

export const ROAD_AUTHORITY_MAPPING = {
  'City / Municipal Road': 'Municipal Corporation / Municipal Council',
  'State Highway': 'State PWD',
  'National Highway': 'NHAI / Relevant NH Authority',
  'Rural / Village Road': 'Zilla Parishad / Rural Development Authority / PWD',
  'Private / Society Road': 'Society / Developer / Private Owner'
};

/**
 * Returns the official responsible authority for a given road type
 * @param {string} roadType
 * @returns {string}
 */
export function getResponsibleAuthority(roadType) {
  if (!roadType) return 'Municipal Corporation / Municipal Council';
  return ROAD_AUTHORITY_MAPPING[roadType] || 'Municipal Corporation / Municipal Council';
}

/**
 * Formats a full authority attribution badge
 * @param {string} roadType
 * @param {string} jurisdiction
 * @returns {{roadType: string, authority: string, jurisdiction: string, display: string}}
 */
export function resolveAuthorityInfo(roadType, jurisdiction = '') {
  const cleanRoadType = roadType || 'City / Municipal Road';
  const authority = getResponsibleAuthority(cleanRoadType);
  const cleanJurisdiction = jurisdiction || 'Local Municipal Ward';
  return {
    roadType: cleanRoadType,
    authority,
    jurisdiction: cleanJurisdiction,
    display: `${authority} (${cleanRoadType} • ${cleanJurisdiction})`
  };
}
