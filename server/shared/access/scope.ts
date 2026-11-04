// Record-scope helpers. Organisation isolation always applies first (every query filters on
// actor.organizationId); branch scope applies on top for users without `branch.all`.
import { AppError } from "../errors/AppError";
import type { Actor } from "../types/actor";
import { can } from "./can";

export function seesAllBranches(actor: Actor): boolean {
  return can(actor, "branch.all");
}

/**
 * Branch filter for READ queries.
 * - With `branch.all`: the requested branch, or `null` (= every branch).
 * - Without: always the actor's own branch; asking for another branch is refused.
 */
export function readBranchScope(actor: Actor, requested?: string | null): string | null {
  if (seesAllBranches(actor)) return requested ?? null;
  if (!actor.branchId) throw AppError.forbidden("Your account is not assigned to a branch");
  if (requested && requested !== actor.branchId) throw AppError.forbidden("You can only view your own branch");
  return actor.branchId;
}

/** Branch a WRITE goes to: the requested one (if allowed) or the actor's home branch. `null` = caller resolves the main branch. */
export function writeBranchScope(actor: Actor, requested?: string | null): string | null {
  if (requested) {
    if (!seesAllBranches(actor) && requested !== actor.branchId) {
      throw AppError.forbidden("You can only record transactions for your own branch");
    }
    return requested;
  }
  return actor.branchId;
}

/** Sales staff without `sale.readall` only see their own sales. Returns the user id to filter on, or null. */
export function ownSalesOnly(actor: Actor): string | null {
  return can(actor, "sale.readall") ? null : actor.id;
}
