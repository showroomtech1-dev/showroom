import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useOrganization"

/**
 * The single branch a sale or quotation is recorded against: the selected one, else the user's own,
 * else the main branch (the same fallback the server uses). Stock shown on screen must come from this
 * branch, not an all-branch total, or the server will reject items that "had stock".
 */
export function useSaleBranch() {
  const { activeBranchId, user } = useAuth()
  const branchesQuery = useBranches(false)
  const branches = branchesQuery.data ?? []
  const saleBranch =
    branches.find((b) => b.id === (activeBranchId || user?.branchId)) ?? branches.find((b) => b.isMain)
  const saleBranchId = activeBranchId || user?.branchId || saleBranch?.id || ""
  return { saleBranch, saleBranchId }
}
