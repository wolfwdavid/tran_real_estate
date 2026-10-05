// Layer 2 of the "views never spend" defense (04-RESEARCH Pattern 3). The data runtime passes this
// as every gateway's reactiveGuard, so get/refresh/rentalListingById throw ReactiveSpendError when
// called while an $effect or $derived is tracking dependencies.
//
// Limit: $effect.tracking() is only true synchronously. A spend after an `await` inside an effect
// runs untracked and is NOT caught here. Layer 1 is the ESLint rule that bans spend calls on
// *gateway/*scheduler objects inside $effect bodies.
export const inReactiveContext = (): boolean => $effect.tracking();
