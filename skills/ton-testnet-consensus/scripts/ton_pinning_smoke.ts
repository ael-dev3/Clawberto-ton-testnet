#!/usr/bin/env node
import { simulatePinnedLeaderWindow, simulateSinglePinnedSlot } from '../../../src/pinning_sim.js';

function expect(claim: boolean, message: string) {
  if (!claim) throw new Error(message);
}

async function main() {
  const single = simulateSinglePinnedSlot();
  expect(single.claims.pendingBlockPinned, 'single-slot sim expected pendingBlockPinned');
  expect(single.claims.secondCandidateIgnored, 'single-slot sim expected secondCandidateIgnored');
  expect(single.claims.slot1Notarized, 'single-slot sim expected slot1Notarized');
  expect(single.claims.slot1UnfinalizedBeforeRecovery, 'single-slot sim expected slot1UnfinalizedBeforeRecovery');
  expect(single.claims.slot2FinalizedByThreeHonest, 'single-slot sim expected slot2FinalizedByThreeHonest');
  expect(single.claims.slot1PrunedAfterSlot2Finalized, 'single-slot sim expected slot1PrunedAfterSlot2Finalized');

  const window = simulatePinnedLeaderWindow(5);
  expect(window.claims.eachByzantineLedSlotPinned, 'window sim expected eachByzantineLedSlotPinned');
  expect(window.claims.noSlotFinalizedDuringWindow, 'window sim expected noSlotFinalizedDuringWindow');
  expect(window.claims.trackedSlotsGrowLinearly, 'window sim expected trackedSlotsGrowLinearly');
  expect(window.claims.standstillWorkGrowsLinearlyForHonestNonPinnedValidator, 'window sim expected standstillWorkGrowsLinearlyForHonestNonPinnedValidator');
  expect(window.claims.recoverySlotPrunesWindow, 'window sim expected recoverySlotPrunesWindow');

  console.log(JSON.stringify({
    ok: true,
    singleSlotConclusion: single.conclusion,
    windowConclusion: window.conclusion,
    windowTrackedSlotsBeforeRecovery: window.beforeRecovery.validators.find((entry) => entry.validator === 'h2')?.trackedSlotCount ?? null,
    windowStandstillMessageEstimateBeforeRecovery: window.beforeRecovery.validators.find((entry) => entry.validator === 'h2')?.standstillMessageEstimate ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
