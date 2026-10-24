/**
 * Pure per-job tech pay lines for the admin-finance money core.
 *
 * No global state, no clock, no env — every input is a parameter. All money
 * is INTEGER CENTS (Math.round); no React imports.
 */

/** How a tech's pay on a job was derived. */
export type PayBasis = 'hourly' | 'flat' | 'prem-bonus' | 'none';

/** Org-wide pay policy values used as fallbacks and prem-bonus inputs. */
export interface JobPayPolicy {
  hourlyRateCents: number;
  premBonusFlatCents: number;
  premBonusPercent: number;
  devDefaultFlatCents: number;
}

/** One tech assigned to a job, with their personal pay settings. */
export interface JobPayTech {
  techId: string;
  name: string;
  workerType: 'employee' | 'contractor';
  techRole: 'prem' | 'dev' | 'service' | null;
  devPayMode: 'hourly' | 'flat' | null;
  hourlyRateCents: number | null;
  flatRateCents: number | null;
  hoursWorked: number;
}

/** Computed pay for one tech on one job. */
export interface JobPayLine {
  techId: string;
  name: string;
  workerType: 'employee' | 'contractor';
  techRole: JobPayTech['techRole'];
  basis: PayBasis;
  amountCents: number;
  note: string;
}

/** Converts integer cents to dollars (display helper; no equivalent existed in money/). */
export function centsToDollars(c: number): number {
  return c / 100;
}

function nonNegInt(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function dollars(c: number): string {
  return centsToDollars(c).toFixed(2);
}

/** Computes one pay line per tech (same order as input) for a job. */
export function computeJobPayLines(input: {
  jobTotalCents: number;
  policy: JobPayPolicy;
  techs: JobPayTech[];
}): JobPayLine[] {
  const { jobTotalCents, policy, techs } = input;
  return techs.map((tech): JobPayLine => {
    const base = {
      techId: tech.techId,
      name: tech.name,
      workerType: tech.workerType,
      techRole: tech.techRole,
    };

    if (tech.techRole === 'dev') {
      if (tech.devPayMode === 'flat') {
        const personal = tech.flatRateCents;
        const usedPolicy = personal === null || personal === undefined;
        const raw = usedPolicy ? policy.devDefaultFlatCents : personal;
        return {
          ...base,
          basis: 'flat',
          amountCents: nonNegInt(raw),
          note: usedPolicy ? 'Policy default flat rate' : 'Flat rate per assembly',
        };
      }
      const personalRate = tech.hourlyRateCents;
      const rate =
        personalRate !== null && personalRate !== undefined && personalRate > 0
          ? personalRate
          : policy.hourlyRateCents;
      const hours =
        Number.isFinite(tech.hoursWorked) && tech.hoursWorked > 0 ? tech.hoursWorked : 0;
      if (!(rate > 0)) {
        return { ...base, basis: 'hourly', amountCents: 0, note: 'No hourly rate set' };
      }
      return {
        ...base,
        basis: 'hourly',
        amountCents: nonNegInt(hours * rate),
        note: `${hours.toFixed(2)} h x $${dollars(rate)}/h`,
      };
    }

    if (tech.techRole === 'prem') {
      const total = Math.max(jobTotalCents, 0);
      const amount =
        policy.premBonusFlatCents + Math.round((policy.premBonusPercent / 100) * total);
      return {
        ...base,
        basis: 'prem-bonus',
        amountCents: nonNegInt(amount),
        note: `$${dollars(policy.premBonusFlatCents)} flat + ${policy.premBonusPercent}% of job total`,
      };
    }

    return { ...base, basis: 'none', amountCents: 0, note: 'No pay role set' };
  });
}
