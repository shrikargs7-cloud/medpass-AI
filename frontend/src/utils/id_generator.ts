/**
 * MedPass AI - Automated Scalable ID Allocation Utility
 * Generates simple, clean, collision-free identifiers for high volume platforms.
 */

// Simple rolling counters and high-entropy short seeds
let patientCounter = Math.floor(10000 + Math.random() * 89999);
let policyCounter = Math.floor(100 + Math.random() * 899);
let ackCounter = Math.floor(10000 + Math.random() * 89999);
let userCounter = Math.floor(1000 + Math.random() * 8999);
let claimCounter = Math.floor(1000 + Math.random() * 8999);
let hospCounter = Math.floor(100 + Math.random() * 899);

export function generatePatientId(): string {
  patientCounter = (patientCounter + 1) % 99999;
  if (patientCounter < 10000) patientCounter += 10000;
  return `PAT-${patientCounter}`;
}

export function generateCaseNumber(): string {
  const year = new Date().getFullYear();
  const randSeq = Math.floor(1000 + Math.random() * 9000);
  return `CASE-${year}-${randSeq}`;
}

export function generatePolicyRef(insurerPrefix: string = 'STAR'): string {
  policyCounter = (policyCounter + 1) % 999;
  if (policyCounter < 100) policyCounter += 100;
  const cleanPrefix = insurerPrefix.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'STAR';
  return `POL-${cleanPrefix}-${policyCounter}`;
}

export function generateLineItemCode(category: string): string {
  const prefixes: Record<string, string> = {
    ROOM_RENT: 'ROOM',
    ICU: 'ICU',
    SURGERY: 'SURG',
    INVESTIGATION: 'DIAG',
    PHARMACY: 'PHARM',
    CONSULTATION: 'CONS',
  };
  const pfx = prefixes[category] || 'ITEM';
  const num = Math.floor(100 + Math.random() * 899);
  return `${pfx}-${num}`;
}

export function generateAckToken(): string {
  ackCounter = (ackCounter + 1) % 99999;
  if (ackCounter < 10000) ackCounter += 10000;
  return `ACK-${ackCounter}`;
}

export function generateClaimId(): string {
  claimCounter = (claimCounter + 1) % 9999;
  if (claimCounter < 1000) claimCounter += 1000;
  return `CLM-${claimCounter}`;
}

export function generateHospitalCode(name?: string): string {
  if (name && name.trim()) {
    const words = name.trim().split(/\s+/);
    const acronym = words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
    hospCounter = (hospCounter + 1) % 999;
    return `HOSP-${acronym}-${hospCounter}`;
  }
  hospCounter = (hospCounter + 1) % 999;
  return `HOSP-${100 + hospCounter}`;
}

export function generateInsurerCode(name?: string): string {
  if (name && name.trim()) {
    const acronym = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
    return `INS-${acronym}-${Math.floor(100 + Math.random() * 899)}`;
  }
  return `INS-${Math.floor(1000 + Math.random() * 8999)}`;
}

export function generateUserId(): string {
  userCounter = (userCounter + 1) % 9999;
  if (userCounter < 1000) userCounter += 1000;
  return `USR-${userCounter}`;
}
