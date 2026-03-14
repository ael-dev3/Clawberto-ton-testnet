export type ValidatorId = 'byz' | 'h1' | 'h2' | 'h3';

type SlotState = {
  pendingBlock: string | null;
  votedNotar: string | null;
  notarCert: string | null;
  votedFinal: boolean;
  finalCert: string | null;
};

type ValidatorState = {
  id: ValidatorId;
  firstNonFinalizedSlot: number;
  slots: Map<number, SlotState>;
};

type Candidate = {
  id: string;
  slot: number;
  parentStatus: 'ok' | 'wait-for-parent';
  validation: 'ok' | 'reject';
};

type SlotSnapshot = {
  slot: number;
  pendingBlock: string | null;
  votedNotar: string | null;
  notarCert: string | null;
  votedFinal: boolean;
  finalCert: string | null;
};

type ValidatorSnapshot = {
  validator: ValidatorId;
  firstNonFinalizedSlot: number;
  trackedSlotsBegin: number;
  trackedSlotsEnd: number;
  trackedSlotCount: number;
  standstillMessageEstimate: number;
  slots: SlotSnapshot[];
};

type EventRecord = {
  step: number;
  actor: ValidatorId | 'all';
  slot: number;
  kind: string;
  details?: Record<string, unknown>;
};

type ScenarioResult = {
  ok: true;
  scenario: string;
  threshold: number;
  claims: Record<string, boolean>;
  conclusion: string;
  beforeRecovery: {
    events: EventRecord[];
    validators: ValidatorSnapshot[];
  };
  afterRecovery: {
    events: EventRecord[];
    validators: ValidatorSnapshot[];
  };
};

function createSlotState(): SlotState {
  return {
    pendingBlock: null,
    votedNotar: null,
    notarCert: null,
    votedFinal: false,
    finalCert: null,
  };
}

function createValidatorState(id: ValidatorId): ValidatorState {
  return {
    id,
    firstNonFinalizedSlot: 1,
    slots: new Map(),
  };
}

function ensureSlot(state: ValidatorState, slot: number) {
  let existing = state.slots.get(slot);
  if (!existing) {
    existing = createSlotState();
    state.slots.set(slot, existing);
  }
  return existing;
}

function trackedInterval(state: ValidatorState) {
  const tracked = [...state.slots.keys()].filter((slot) => slot >= state.firstNonFinalizedSlot).sort((a, b) => a - b);
  const begin = state.firstNonFinalizedSlot;
  const end = tracked.length ? tracked[tracked.length - 1] + 1 : state.firstNonFinalizedSlot;
  return { begin, end, count: Math.max(0, end - begin) };
}

function standstillMessageEstimate(state: ValidatorState) {
  const { begin, end } = trackedInterval(state);
  let messages = 0;
  for (let slot = begin; slot < end; slot += 1) {
    const local = state.slots.get(slot);
    if (!local) continue;
    if (local.notarCert) messages += 1;
    if (local.votedFinal && !local.finalCert) messages += 1;
    if (local.votedNotar && !local.notarCert) messages += 1;
  }
  return messages;
}

function snapshotValidator(state: ValidatorState): ValidatorSnapshot {
  const interval = trackedInterval(state);
  const slots = [...state.slots.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, local]) => ({
      slot,
      pendingBlock: local.pendingBlock,
      votedNotar: local.votedNotar,
      notarCert: local.notarCert,
      votedFinal: local.votedFinal,
      finalCert: local.finalCert,
    }));
  return {
    validator: state.id,
    firstNonFinalizedSlot: state.firstNonFinalizedSlot,
    trackedSlotsBegin: interval.begin,
    trackedSlotsEnd: interval.end,
    trackedSlotCount: interval.count,
    standstillMessageEstimate: standstillMessageEstimate(state),
    slots,
  };
}

class PinningSimulation {
  readonly threshold = 3;
  readonly validators = new Map<ValidatorId, ValidatorState>();
  readonly events: EventRecord[] = [];
  private step = 0;

  constructor() {
    for (const id of ['byz', 'h1', 'h2', 'h3'] as const) {
      this.validators.set(id, createValidatorState(id));
    }
  }

  private record(actor: ValidatorId | 'all', slot: number, kind: string, details?: Record<string, unknown>) {
    this.step += 1;
    this.events.push({ step: this.step, actor, slot, kind, details });
  }

  receiveCandidate(validator: ValidatorId, candidate: Candidate) {
    const state = this.validators.get(validator)!;
    const slot = ensureSlot(state, candidate.slot);
    if (slot.votedNotar) {
      this.record(validator, candidate.slot, 'candidate-ignored-already-voted-notar', { candidateId: candidate.id });
      return;
    }
    if (slot.pendingBlock && slot.pendingBlock !== candidate.id) {
      this.record(validator, candidate.slot, 'candidate-ignored-different-pending-block', {
        candidateId: candidate.id,
        existingPendingBlock: slot.pendingBlock,
      });
      return;
    }
    if (!slot.pendingBlock) {
      slot.pendingBlock = candidate.id;
      this.record(validator, candidate.slot, 'pending-block-set', { candidateId: candidate.id });
    }
    this.tryNotarize(validator, candidate);
  }

  private tryNotarize(validator: ValidatorId, candidate: Candidate) {
    const state = this.validators.get(validator)!;
    const slot = ensureSlot(state, candidate.slot);
    if (candidate.parentStatus === 'wait-for-parent') {
      this.record(validator, candidate.slot, 'try-notarize-returned-wait-for-parent', { candidateId: candidate.id });
      return;
    }
    if (candidate.validation === 'reject') {
      this.record(validator, candidate.slot, 'try-notarize-returned-candidate-reject', { candidateId: candidate.id });
      return;
    }
    slot.votedNotar = candidate.id;
    this.record(validator, candidate.slot, 'voted-notar', { candidateId: candidate.id });
  }

  notarize(slotNumber: number, candidateId: string) {
    const voters = [...this.validators.values()].filter((state) => ensureSlot(state, slotNumber).votedNotar === candidateId);
    if (voters.length < this.threshold) {
      this.record('all', slotNumber, 'notarization-missed-threshold', { candidateId, votes: voters.length, threshold: this.threshold });
      return false;
    }
    this.record('all', slotNumber, 'notarization-observed', { candidateId, votes: voters.map((state) => state.id) });
    for (const state of this.validators.values()) {
      const slot = ensureSlot(state, slotNumber);
      slot.notarCert = candidateId;
      if (!slot.votedFinal && slot.votedNotar === slot.notarCert) {
        slot.votedFinal = true;
        this.record(state.id, slotNumber, 'voted-final', { candidateId });
      }
    }
    return true;
  }

  finalize(slotNumber: number, candidateId: string, voters: ValidatorId[]) {
    if (voters.length < this.threshold) {
      this.record('all', slotNumber, 'finalization-missed-threshold', { candidateId, votes: voters, threshold: this.threshold });
      return false;
    }
    this.record('all', slotNumber, 'finalization-observed', { candidateId, votes: voters });
    for (const state of this.validators.values()) {
      const slot = ensureSlot(state, slotNumber);
      slot.finalCert = candidateId;
      state.firstNonFinalizedSlot = Math.max(state.firstNonFinalizedSlot, slotNumber + 1);
      for (const trackedSlot of [...state.slots.keys()]) {
        if (trackedSlot < state.firstNonFinalizedSlot) state.slots.delete(trackedSlot);
      }
    }
    return true;
  }

  snapshot() {
    return [...this.validators.values()].map(snapshotValidator);
  }
}

function candidate(slot: number, suffix: string, parentStatus: Candidate['parentStatus'], validation: Candidate['validation'] = 'ok'): Candidate {
  return {
    id: `slot${slot}-${suffix}`,
    slot,
    parentStatus,
    validation,
  };
}

export function simulateSinglePinnedSlot(): ScenarioResult {
  const sim = new PinningSimulation();
  const badA = candidate(1, 'A', 'wait-for-parent');
  const goodB = candidate(1, 'B', 'ok');

  sim.receiveCandidate('h1', badA);
  sim.receiveCandidate('h2', goodB);
  sim.receiveCandidate('h3', goodB);
  sim.receiveCandidate('byz', goodB);
  sim.receiveCandidate('h1', goodB);
  sim.notarize(1, goodB.id);
  sim.finalize(1, goodB.id, ['h2', 'h3']);

  const beforeRecovery = {
    events: [...sim.events],
    validators: sim.snapshot(),
  };

  const slot2 = candidate(2, 'C', 'ok');
  sim.receiveCandidate('h1', slot2);
  sim.receiveCandidate('h2', slot2);
  sim.receiveCandidate('h3', slot2);
  sim.notarize(2, slot2.id);
  sim.finalize(2, slot2.id, ['h1', 'h2', 'h3']);

  const afterRecovery = {
    events: sim.events.slice(beforeRecovery.events.length),
    validators: sim.snapshot(),
  };

  return {
    ok: true,
    scenario: 'single-pinned-slot',
    threshold: sim.threshold,
    claims: {
      pendingBlockPinned: beforeRecovery.validators.find((v) => v.validator === 'h1')?.slots.some((slot) => slot.slot === 1 && slot.pendingBlock === badA.id) ?? false,
      secondCandidateIgnored: beforeRecovery.events.some((event) => event.kind === 'candidate-ignored-different-pending-block' && event.actor === 'h1' && event.slot === 1),
      slot1Notarized: beforeRecovery.events.some((event) => event.kind === 'notarization-observed' && event.slot === 1 && event.details?.candidateId === goodB.id),
      slot1UnfinalizedBeforeRecovery: beforeRecovery.events.some((event) => event.kind === 'finalization-missed-threshold' && event.slot === 1),
      slot2FinalizedByThreeHonest: afterRecovery.events.some((event) => event.kind === 'finalization-observed' && event.slot === 2),
      slot1PrunedAfterSlot2Finalized: (afterRecovery.validators.find((v) => v.validator === 'h1')?.trackedSlotCount ?? 99) === 0,
    },
    conclusion: 'A single pinned slot creates real finalization lag, but an immediately following honest slot can still finalize and prune the lagging slot.',
    beforeRecovery,
    afterRecovery,
  };
}

export function simulatePinnedLeaderWindow(windowSlots = 5): ScenarioResult {
  const sim = new PinningSimulation();
  for (let slotNumber = 1; slotNumber <= windowSlots; slotNumber += 1) {
    const badA = candidate(slotNumber, 'A', 'wait-for-parent');
    const goodB = candidate(slotNumber, 'B', 'ok');
    sim.receiveCandidate('h1', badA);
    sim.receiveCandidate('h2', goodB);
    sim.receiveCandidate('h3', goodB);
    sim.receiveCandidate('byz', goodB);
    sim.receiveCandidate('h1', goodB);
    sim.notarize(slotNumber, goodB.id);
    sim.finalize(slotNumber, goodB.id, ['h2', 'h3']);
  }

  const beforeRecovery = {
    events: [...sim.events],
    validators: sim.snapshot(),
  };

  const recoverySlot = windowSlots + 1;
  const recoveryCandidate = candidate(recoverySlot, 'H', 'ok');
  sim.receiveCandidate('h1', recoveryCandidate);
  sim.receiveCandidate('h2', recoveryCandidate);
  sim.receiveCandidate('h3', recoveryCandidate);
  sim.notarize(recoverySlot, recoveryCandidate.id);
  sim.finalize(recoverySlot, recoveryCandidate.id, ['h1', 'h2', 'h3']);

  const afterRecovery = {
    events: sim.events.slice(beforeRecovery.events.length),
    validators: sim.snapshot(),
  };

  const h2Before = beforeRecovery.validators.find((v) => v.validator === 'h2');
  const h1Before = beforeRecovery.validators.find((v) => v.validator === 'h1');

  return {
    ok: true,
    scenario: 'pinned-byzantine-window',
    threshold: sim.threshold,
    claims: {
      eachByzantineLedSlotPinned: beforeRecovery.events.filter((event) => event.kind === 'candidate-ignored-different-pending-block' && event.actor === 'h1').length === windowSlots,
      noSlotFinalizedDuringWindow: beforeRecovery.events.every((event) => event.kind !== 'finalization-observed'),
      trackedSlotsGrowLinearly: (h2Before?.trackedSlotCount ?? 0) === windowSlots,
      standstillWorkGrowsLinearlyForHonestNonPinnedValidator: (h2Before?.standstillMessageEstimate ?? 0) >= windowSlots,
      pinnedValidatorCarriesLowerButGrowingStandstillState: (h1Before?.trackedSlotCount ?? 0) === windowSlots,
      recoverySlotPrunesWindow: (afterRecovery.validators.find((v) => v.validator === 'h2')?.trackedSlotCount ?? 99) === 0,
    },
    conclusion: 'Consecutive byzantine-led pinned slots can accumulate linear tracked-slot and rebroadcast work until a later honest slot finalizes and prunes the window.',
    beforeRecovery,
    afterRecovery,
  };
}
