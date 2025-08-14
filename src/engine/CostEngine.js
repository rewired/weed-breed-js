// src/engine/CostEngine.js
// ES Modules - Cost accounting via price maps (Devices, Strains)
// Initial capital support + aliases for existing code + optional entries tracking

export class CostEngine {
  /**
   * @param {Object} opts
   * @param {Map<string, any>} [opts.devicePriceMap] - deviceId -> { capitalExpenditure, baseMaintenanceCostPerTick, costIncreasePer1000Ticks, energyPricePerKWhOverride? }
   * @param {Map<string, any>} [opts.strainPriceMap] - strainId -> { seedPrice, harvestPricePerGram }
   * @param {number} [opts.energyPricePerKWh=0.35]  - global electricity price (EUR/kWh), if no device override exists
   * @param {number} [opts.initialCapital=0]        - initial capital in EUR
   * @param {boolean} [opts.keepEntries=false]      - If true, individual bookings are stored in the ledger (more debug output)
   */
  constructor({
    devicePriceMap = new Map(),
    strainPriceMap = new Map(),
    energyPricePerKWh = 0.35,
    waterPricePerLiter = 0.002, // 2 EUR/m³
    pricePerMgN = 0.001,
    pricePerMgP = 0.002,
    pricePerMgK = 0.0015,
    initialCapital = 0,
    itemPriceMultiplier = 1.0,
    harvestPriceMultiplier = 1.0,
    rentPerSqmStructurePerTick = 0,
    rentPerSqmRoomPerTick = 0,
    keepEntries = false
  } = {}) {
    this.devicePriceMap = devicePriceMap;
    this.strainPriceMap = strainPriceMap;
    this.energyPricePerKWh = Number(energyPricePerKWh) || 0;
    this.waterPricePerLiter = Number(waterPricePerLiter) || 0;
    this.pricePerMgN = Number(pricePerMgN) || 0;
    this.pricePerMgP = Number(pricePerMgP) || 0;
    this.pricePerMgK = Number(pricePerMgK) || 0;
    this.itemPriceMultiplier = Number(itemPriceMultiplier) || 1.0;
    this.harvestPriceMultiplier = Number(harvestPriceMultiplier) || 1.0;
    this.rentPerSqmStructurePerTick = Number(rentPerSqmStructurePerTick) || 0;
    this.rentPerSqmRoomPerTick = Number(rentPerSqmRoomPerTick) || 0;
    this.keepEntries = !!keepEntries;

    // 💰 Current balance (incl. initial capital)
    this.balanceEUR = Number(initialCapital) || 0;
    this.initialCapital = Number(initialCapital) || 0;

    // 💰 Cumulative grand totals
    this.grandTotalRevenueEUR = 0;
    this.grandTotalEnergyEUR = 0;
    this.grandTotalWaterEUR = 0;
    this.grandTotalFertilizerEUR = 0;
    this.grandTotalRentEUR = 0;
    this.grandTotalMaintenanceEUR = 0;
    this.grandTotalCapexEUR = 0;
    this.grandTotalOtherExpenseEUR = 0;

    this._tickCounter = 0;
    this._initEmptyLedger();
  }

  /** internal reset of the tick ledger */
  _initEmptyLedger() {
    this.ledger = {
      tick: this._tickCounter,
      openingBalanceEUR: this.balanceEUR,
      closingBalanceEUR: this.balanceEUR, // finalized in commitTick
      revenueEUR: 0,
      // Expenses
      energyEUR: 0,
      waterEUR: 0,
      fertilizerEUR: 0,
      rentEUR: 0,
      maintenanceEUR: 0,
      capexEUR: 0,
      otherExpenseEUR: 0,
      // Consumption
      energyKWh: 0,
      waterL: 0,
      // Calculated
      netEUR: 0,
      // Only if needed: collect entries (can generate a lot of output)
      entries: this.keepEntries ? [] : undefined
    };
  }

  /** Tick start - sets counter, freezes opening balance */
  startTick(tickNumber) {
    if (Number.isFinite(tickNumber)) this._tickCounter = tickNumber;
    else this._tickCounter += 1;
    this._initEmptyLedger();
  }

  /** Get current balance */
  getBalance() {
    return this.balanceEUR;
  }

  /** Electricity price (override per device, otherwise global) */
  getEnergyPriceForDevice(deviceId) {
    const cfg = this.devicePriceMap.get(deviceId);
    const override = Number(cfg?.energyPricePerKWhOverride ?? NaN);
    return Number.isFinite(override) ? override : this.energyPricePerKWh;
  }

  /** Book energy consumption of a device (kWh in the current tick) */
  bookEnergy(deviceId, kWh) {
    const amountKWh = Number(kWh) || 0;
    if (amountKWh <= 0) return;

    this.ledger.energyKWh += amountKWh;
    const price = this.getEnergyPriceForDevice(deviceId);
    const eur = amountKWh * price;
    this._add('energy', eur, this.keepEntries ? { deviceId, kWh: amountKWh, pricePerKWh: price } : undefined);
  }

  /** Book water consumption (liters in the current tick) */
  bookWater(liters) {
    const amountL = Number(liters) || 0;
    if (amountL <= 0) return;

    this.ledger.waterL += amountL;
    const eur = amountL * this.waterPricePerLiter;
    if (eur > 0) {
      this._add('water', eur, this.keepEntries ? { liters: amountL, pricePerLiter: this.waterPricePerLiter } : undefined);
    }
  }

  /** Book fertilizer consumption (in mg N, P, K) */
  bookFertilizer(npkDemand) {
    const demandN = Number(npkDemand?.N) || 0;
    const demandP = Number(npkDemand?.P) || 0;
    const demandK = Number(npkDemand?.K) || 0;

    if (demandN <= 0 && demandP <= 0 && demandK <= 0) return;

    const costN = demandN * this.pricePerMgN;
    const costP = demandP * this.pricePerMgP;
    const costK = demandK * this.pricePerMgK;
    const totalCost = costN + costP + costK;

    if (totalCost > 0) {
      this._add('fertilizer', totalCost, this.keepEntries ? { demand: { N: demandN, P: demandP, K: demandK } } : undefined);
    }
  }

  /**
   * 🔁 Alias for existing code:
   * Some callers use `bookDeviceEnergy(deviceId, kWh)`.
   */
  bookDeviceEnergy(deviceId, kWh) {
    return this.bookEnergy(deviceId, kWh);
  }

  /** Book maintenance costs of a device for the current tick (with escalation per 1000 ticks) */
  bookDeviceMaintenance(deviceId, tick = this._tickCounter) {
    const cfg = this.devicePriceMap.get(deviceId);
    if (!cfg) return;

    const base = Number(cfg.baseMaintenanceCostPerTick ?? 0);
    const inc = Number(cfg.costIncreasePer1000Ticks ?? 0);
    if (base <= 0 && inc <= 0) return;

    const factor = 1 + inc * Math.floor(tick / 1000);
    const eur = base * factor;
    if (eur > 0) {
      this._add('maintenance', eur, this.keepEntries ? { deviceId, factor } : undefined);
    }
  }

  /** Book device purchase (CapEx) explicitly */
  bookCapex(deviceId, qty = 1) {
    const cfg = this.devicePriceMap.get(deviceId);
    if (!cfg) return;

    const unit = Number(cfg.capitalExpenditure ?? 0) * this.itemPriceMultiplier;
    const count = Number(qty) || 0;
    const eur = unit * count;
    if (eur > 0) {
      this._add('capex', eur, this.keepEntries ? { deviceId, qty: count, unitPrice: unit } : undefined);
    }
  }

  /** General capital expenditures (CapEx) not tied to a device (e.g., renovation) */
  bookGeneralCapex(label, eur) {
    const val = Number(eur) || 0;
    if (val > 0) {
      this._add('capex', val, this.keepEntries ? { label } : undefined);
    }
  }

  /** General expenses (not maintenance/energy/CapEx), e.g., substrate, rent, personnel etc. */
  bookExpense(label, eur) {
    const val = Number(eur) || 0;
    if (val <= 0) return;

    const type = String(label).startsWith('Rent') ? 'rent' : 'expense';
    this._add(type, val, this.keepEntries ? { label } : undefined);
  }

  /** Seed purchase as a convenience */
  bookSeeds(strainId, quantity) {
    const cfg = this.strainPriceMap.get(strainId);
    const unit = Number(cfg?.seedPrice ?? 0) * this.itemPriceMultiplier;
    const qty = Number(quantity) || 0;
    const eur = unit * qty;
    if (eur > 0) {
      this._add('expense', eur, this.keepEntries ? { subType: 'seeds', strainId, qty, unitPrice: unit } : undefined);
    }
  }

  /** Book revenue (e.g., sales) */
  bookRevenue(label, eur) {
    let val = Number(eur) || 0;
    if (label === 'Harvest') {
      val *= this.harvestPriceMultiplier;
    }
    if (val > 0) {
      this._add('revenue', val, this.keepEntries ? { label } : undefined);
    }
  }

  /**
   * 📊 Totals/Preview for the current tick **without** closing.
   * Does NOT mutate the state; calculates netEUR & provisional closingBalanceEUR.
   */
  getTotals() {
    const {
      energyEUR, maintenanceEUR, capexEUR, rentEUR, waterEUR, fertilizerEUR, otherExpenseEUR,
      revenueEUR, openingBalanceEUR, tick, energyKWh, waterL, entries
    } = this.ledger;

    const totalExpensesEUR = energyEUR + maintenanceEUR + capexEUR + rentEUR + waterEUR + fertilizerEUR + otherExpenseEUR;
    const netEUR = revenueEUR - totalExpensesEUR;
    const closingBalanceEUR = openingBalanceEUR + netEUR;

    return {
      tick,
      openingBalanceEUR,
      // Revenues
      revenueEUR,
      // Expenses
      energyEUR,
      waterEUR,
      fertilizerEUR,
      rentEUR,
      maintenanceEUR,
      capexEUR,
      otherExpenseEUR,
      totalExpensesEUR,
      // Consumption
      energyKWh,
      waterL,
      // Calculated
      netEUR,
      closingBalanceEUR,
      // Only if keepEntries=true, otherwise undefined (=> less debug noise)
      entries
    };
  }

  /**
   * ✅ Tick closing - calculates net and adjusts the balance.
   * Returns a flat summary.
   */
  commitTick() {
    const totals = this.getTotals();
    this.ledger.netEUR = totals.netEUR;
    this.balanceEUR = this.ledger.closingBalanceEUR = totals.closingBalanceEUR;

    // Update cumulative totals
    this.grandTotalRevenueEUR += this.ledger.revenueEUR;
    this.grandTotalEnergyEUR += this.ledger.energyEUR;
    this.grandTotalWaterEUR += this.ledger.waterEUR;
    this.grandTotalFertilizerEUR += this.ledger.fertilizerEUR;
    this.grandTotalRentEUR += this.ledger.rentEUR;
    this.grandTotalMaintenanceEUR += this.ledger.maintenanceEUR;
    this.grandTotalCapexEUR += this.ledger.capexEUR;
    this.grandTotalOtherExpenseEUR += this.ledger.otherExpenseEUR;

    return { ...totals, totalExpensesEUR: totals.totalExpensesEUR };
  }

  /**
   * 📈 Grand total over the entire simulation runtime.
   */
  getGrandTotals() {
    const totalExpenses = this.grandTotalEnergyEUR
      + this.grandTotalMaintenanceEUR
      + this.grandTotalCapexEUR
      + this.grandTotalRentEUR
      + this.grandTotalWaterEUR
      + this.grandTotalFertilizerEUR
      + this.grandTotalOtherExpenseEUR;

    return {
      simulationTicks: this._tickCounter,
      initialCapitalEUR: this.initialCapital,
      finalBalanceEUR: this.balanceEUR,
      grossProfitEUR: this.balanceEUR - this.initialCapital,
      totalRevenueEUR: this.grandTotalRevenueEUR,
      totalExpensesEUR: totalExpenses,
      totalEnergyEUR: this.grandTotalEnergyEUR,
      totalWaterEUR: this.grandTotalWaterEUR,
      totalFertilizerEUR: this.grandTotalFertilizerEUR,
      totalRentEUR: this.grandTotalRentEUR,
      totalMaintenanceEUR: this.grandTotalMaintenanceEUR,
      totalCapexEUR: this.grandTotalCapexEUR,
      totalOtherExpenseEUR: this.grandTotalOtherExpenseEUR
    };
  }

  /** internal summation + optional entries tracking */
  _add(type, eur, extra) {
    const val = Number(eur) || 0;
    if (val <= 0) return;

    if (type === 'energy') this.ledger.energyEUR += val;
    else if (type === 'water') this.ledger.waterEUR += val;
    else if (type === 'fertilizer') this.ledger.fertilizerEUR += val;
    else if (type === 'rent') this.ledger.rentEUR += val;
    else if (type === 'maintenance') this.ledger.maintenanceEUR += val;
    else if (type === 'capex') this.ledger.capexEUR += val;
    else if (type === 'expense') this.ledger.otherExpenseEUR += val;
    else if (type === 'revenue') this.ledger.revenueEUR += val;

    if (this.keepEntries && this.ledger.entries) {
      const entry = { type, eur: val };
      if (extra && typeof extra === 'object') Object.assign(entry, extra);
      this.ledger.entries.push(entry);
    }
  }
}

export default CostEngine;
