import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { v } from 'convex/values';

const DEFAULT_SETTINGS = {
  general: {
    city: 'Sofia',
    currency: 'EUR',
    targetGrossYieldPct: 6,
    targetNetYieldPct: 4.5,
    rehabCostPerSqm: 300,
    transactionCostPct: 3,
    vacancyPct: 5,
    managementFeePct: 8
  },
  airbnb: {
    occupancyPct: 65,
    dailyRateEur: 65,
    operatingExpensePct: 30
  },
  leverage: {
    enabled: true,
    mortgageRate: 3.5,
    loanTermYears: 25,
    downPaymentPct: 20,
    ltvPct: 80,
    originationFeePct: 1,
    annualInsuranceEur: 250
  },
  flags: {
    cocGreenPct: 8,
    cocYellowPct: 4,
    dscrMinimum: 1.25,
    rateStressPct: 1
  }
};

const settingsPatch = v.object({
  general: v.optional(
    v.object({
      city: v.optional(v.string()),
      currency: v.optional(v.string()),
      targetGrossYieldPct: v.optional(v.number()),
      targetNetYieldPct: v.optional(v.number()),
      rehabCostPerSqm: v.optional(v.number()),
      transactionCostPct: v.optional(v.number()),
      vacancyPct: v.optional(v.number()),
      managementFeePct: v.optional(v.number())
    })
  ),
  airbnb: v.optional(
    v.object({
      occupancyPct: v.optional(v.number()),
      dailyRateEur: v.optional(v.number()),
      operatingExpensePct: v.optional(v.number())
    })
  ),
  leverage: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      mortgageRate: v.optional(v.number()),
      loanTermYears: v.optional(v.number()),
      downPaymentPct: v.optional(v.number()),
      ltvPct: v.optional(v.number()),
      originationFeePct: v.optional(v.number()),
      annualInsuranceEur: v.optional(v.number())
    })
  ),
  flags: v.optional(
    v.object({
      cocGreenPct: v.optional(v.number()),
      cocYellowPct: v.optional(v.number()),
      dscrMinimum: v.optional(v.number()),
      rateStressPct: v.optional(v.number())
    })
  )
});

const nowIso = () => new Date().toISOString();

const cloneDefaults = () => ({
  general: { ...DEFAULT_SETTINGS.general },
  airbnb: { ...DEFAULT_SETTINGS.airbnb },
  leverage: { ...DEFAULT_SETTINGS.leverage },
  flags: { ...DEFAULT_SETTINGS.flags }
});

const normalizeExisting = (existing) => ({
  general: { ...DEFAULT_SETTINGS.general, ...(existing?.general ?? {}) },
  airbnb: { ...DEFAULT_SETTINGS.airbnb, ...(existing?.airbnb ?? {}) },
  leverage: { ...DEFAULT_SETTINGS.leverage, ...(existing?.leverage ?? {}) },
  flags: { ...DEFAULT_SETTINGS.flags, ...(existing?.flags ?? {}) }
});

const mergeSettings = (base, updates) => {
  const patch = updates ?? {};
  const next = {
    general: { ...base.general, ...(patch.general ?? {}) },
    airbnb: { ...base.airbnb, ...(patch.airbnb ?? {}) },
    leverage: { ...base.leverage, ...(patch.leverage ?? {}) },
    flags: { ...base.flags, ...(patch.flags ?? {}) }
  };

  if (patch.leverage?.downPaymentPct !== undefined) {
    next.leverage.ltvPct = 100 - Number(patch.leverage.downPaymentPct);
  } else if (patch.leverage?.ltvPct !== undefined) {
    next.leverage.downPaymentPct = 100 - Number(patch.leverage.ltvPct);
  }

  return next;
};

const firstSettingsDoc = async (db) => {
  const rows = await db.query('settings').take(1);
  return rows[0] ?? null;
};

export const defaultSettings = query({
  args: {},
  handler: async () => {
    return { ...cloneDefaults(), updatedAt: null };
  }
});

export const get = query({
  args: {},
  handler: async ({ db }) => {
    const existing = await firstSettingsDoc(db);
    if (!existing) {
      return { ...cloneDefaults(), updatedAt: null };
    }

    return {
      ...normalizeExisting(existing),
      updatedAt: existing.updatedAt
    };
  }
});

export const update = mutation({
  args: { updates: v.optional(settingsPatch) },
  handler: async ({ db }, { updates }) => {
    const existing = await firstSettingsDoc(db);
    const base = normalizeExisting(existing);
    const record = {
      ...mergeSettings(base, updates),
      updatedAt: nowIso()
    };

    if (existing) {
      await db.patch(existing._id, record);
      return await db.get(existing._id);
    }

    const id = await db.insert('settings', record);
    return await db.get(id);
  }
});
